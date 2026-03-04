const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const PLAN_LIMITS = {
  FREE_TRIAL:   10,
  STARTER:      20,
  STANDARD:     50,
  PROFESSIONAL: 100,
  ENTERPRISE:   9999,
};

// ─── Properties ──────────────────────────────────────────────────────────────

/** GET /api/admin/properties */
exports.listProperties = async (req, res, next) => {
  try {
    const props = await prisma.property.findMany({
      include: {
        subscription: true,
        _count: { select: { rooms: { where: { isActive: true } }, tenants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(props);
  } catch (e) { next(e); }
};

/** POST /api/admin/properties — สร้างหอพักใหม่ + User + Subscription */
exports.createProperty = async (req, res, next) => {
  try {
    const { name, ownerName, phone, address, plan, expiresAt,
            username, password,
            lineChannelAccessToken, lineChannelSecret } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'กรุณากรอก ชื่อหอ, username, password' });
    }

    const hashed   = await bcrypt.hash(password, 12);
    const roomLimit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE_TRIAL;

    const prop = await prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: { name, ownerName, phone, address, lineChannelAccessToken, lineChannelSecret },
      });

      await tx.user.create({
        data: {
          propertyId: property.id,
          username,
          password:   hashed,
          role:       'PROPERTY_ADMIN',
        },
      });

      await tx.subscription.create({
        data: {
          propertyId: property.id,
          plan:       plan ?? 'FREE_TRIAL',
          roomLimit,
          startDate:  new Date(),
          expiresAt:  expiresAt ? new Date(expiresAt) : null,
        },
      });

      // Default settings
      await tx.propertySettings.createMany({
        data: [
          { propertyId: property.id, key: 'electricRate', value: '8' },
          { propertyId: property.id, key: 'waterRate',    value: '18' },
        ],
      });

      return property;
    });

    res.status(201).json(prop);
  } catch (e) { next(e); }
};

/** PUT /api/admin/properties/:id */
exports.updateProperty = async (req, res, next) => {
  try {
    const { name, ownerName, phone, address, isActive,
            lineChannelAccessToken, lineChannelSecret } = req.body;
    const prop = await prisma.property.update({
      where: { id: req.params.id },
      data:  { name, ownerName, phone, address, isActive,
               lineChannelAccessToken, lineChannelSecret },
    });
    res.json(prop);
  } catch (e) { next(e); }
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

/** GET /api/admin/properties/:id/subscription */
exports.getSubscription = async (req, res, next) => {
  try {
    const sub = await prisma.subscription.findUnique({ where: { propertyId: req.params.id } });
    res.json(sub);
  } catch (e) { next(e); }
};

/** PUT /api/admin/properties/:id/subscription — อัปเกรด/ต่ออายุ */
exports.updateSubscription = async (req, res, next) => {
  try {
    const { plan, expiresAt, isActive } = req.body;
    const roomLimit = plan ? (PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE_TRIAL) : undefined;

    const sub = await prisma.subscription.upsert({
      where:  { propertyId: req.params.id },
      update: {
        ...(plan      ? { plan, roomLimit } : {}),
        ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        ...(isActive  !== undefined ? { isActive }  : {}),
      },
      create: {
        propertyId: req.params.id,
        plan:       plan ?? 'FREE_TRIAL',
        roomLimit:  roomLimit ?? 10,
        expiresAt:  expiresAt ? new Date(expiresAt) : null,
      },
    });
    res.json(sub);
  } catch (e) { next(e); }
};

// ─── Users ────────────────────────────────────────────────────────────────────

/** GET /api/admin/users */
exports.listUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, isActive: true,
                propertyId: true, createdAt: true,
                property: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (e) { next(e); }
};

/** POST /api/admin/users — สร้าง user ใหม่ */
exports.createUser = async (req, res, next) => {
  try {
    const { username, password, role, propertyId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอก username และ password' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: { username, password: hashed, role: role ?? 'PROPERTY_ADMIN', propertyId: propertyId ?? null },
      select: { id: true, username: true, role: true, propertyId: true, isActive: true },
    });
    res.status(201).json(user);
  } catch (e) { next(e); }
};

/** PUT /api/admin/users/:id */
exports.updateUser = async (req, res, next) => {
  try {
    const { username, password, isActive } = req.body;
    const data = { username, isActive };
    if (password) data.password = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where:  { id: req.params.id },
      data,
      select: { id: true, username: true, role: true, propertyId: true, isActive: true },
    });
    res.json(user);
  } catch (e) { next(e); }
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

/** GET /api/admin/stats */
exports.stats = async (req, res, next) => {
  try {
    const [totalProps, activeProps, totalRooms, subs] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { isActive: true } }),
      prisma.room.count({ where: { isActive: true } }),
      prisma.subscription.groupBy({ by: ['plan'], _count: { plan: true } }),
    ]);

    res.json({
      totalProperties:  totalProps,
      activeProperties: activeProps,
      totalRooms,
      planBreakdown: subs.reduce((m, s) => ({ ...m, [s.plan]: s._count.plan }), {}),
    });
  } catch (e) { next(e); }
};
