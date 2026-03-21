const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.list = async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where:   { propertyId: req.propertyId },
      include: { contracts: { where: { isActive: true }, include: { room: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(tenants);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findFirstOrThrow({
      where: { id: req.params.id, propertyId: req.propertyId },
      include: { contracts: { include: { room: true, invoices: { orderBy: { createdAt: 'desc' }, take: 6 } } } },
    });
    res.json(tenant);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, nickname, phone, lineUserId, nationalId, note } = req.body;
    const tenant = await prisma.tenant.create({
      data: { propertyId: req.propertyId, name, nickname, phone, lineUserId, nationalId, note },
    });
    res.status(201).json(tenant);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, nickname, phone, lineUserId, nationalId, note } = req.body;
    const exists = await prisma.tenant.findFirst({ where: { id: req.params.id, propertyId: req.propertyId } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบผู้เช่า' });
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { name, nickname, phone, lineUserId, nationalId, note },
    });
    res.json(tenant);
  } catch (e) {
    if (e?.code === 'P2002' && e?.meta?.target?.includes('lineUserId')) {
      return res.status(409).json({ error: 'Line User ID นี้ถูกใช้งานโดยผู้เช่าท่านอื่นแล้ว' });
    }
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const contracts = await prisma.contract.count({ where: { tenantId: id } });
    if (contracts > 0) {
      return res.status(409).json({ error: 'ไม่สามารถลบผู้เช่าที่มีสัญญาอยู่ได้\nกรุณายกเลิกสัญญาทั้งหมดก่อน' });
    }
    await prisma.tenant.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.listVehicles = async (req, res, next) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId: req.params.id, propertyId: req.propertyId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(vehicles);
  } catch (e) { next(e); }
};

exports.addVehicle = async (req, res, next) => {
  try {
    const { type, plate, brand, color, note } = req.body;
    if (!type || !plate) return res.status(400).json({ error: 'กรุณาระบุประเภทและเลขทะเบียน' });
    if (!['CAR', 'MOTORCYCLE'].includes(type)) return res.status(400).json({ error: 'ประเภทรถไม่ถูกต้อง' });

    // รถยนต์ได้แค่ 1 คัน
    if (type === 'CAR') {
      const existing = await prisma.vehicle.count({
        where: { tenantId: req.params.id, type: 'CAR' },
      });
      if (existing >= 1) return res.status(409).json({ error: 'ผู้เช่าสามารถลงทะเบียนรถยนต์ได้สูงสุด 1 คัน' });
    }

    const vehicle = await prisma.vehicle.create({
      data: { tenantId: req.params.id, propertyId: req.propertyId, type, plate: plate.toUpperCase(), brand, color, note },
    });
    res.status(201).json(vehicle);
  } catch (e) { next(e); }
};

exports.removeVehicle = async (req, res, next) => {
  try {
    const v = await prisma.vehicle.findFirst({
      where: { id: req.params.vehicleId, tenantId: req.params.id, propertyId: req.propertyId },
    });
    if (!v) return res.status(404).json({ error: 'ไม่พบข้อมูลรถ' });
    await prisma.vehicle.delete({ where: { id: v.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.createContract = async (req, res, next) => {
  try {
    const { roomId, startDate, endDate, depositPaid, contractFiles } = req.body;
    if (!roomId || !startDate) {
      return res.status(400).json({ error: 'roomId และ startDate จำเป็นต้องระบุ' });
    }
    // Deactivate existing active contract for this room
    await prisma.contract.updateMany({
      where: { roomId, isActive: true },
      data:  { isActive: false },
    });
    const contract = await prisma.contract.create({
      data: {
        tenantId:      req.params.id,
        roomId,
        startDate:     new Date(startDate),
        endDate:       endDate ? new Date(endDate) : null,
        depositPaid:   depositPaid ?? null,
        contractFiles: Array.isArray(contractFiles) ? contractFiles : [],
        isActive:      true,
      },
      include: { room: true, tenant: true },
    });
    res.status(201).json(contract);
  } catch (e) { next(e); }
};

exports.updateContract = async (req, res, next) => {
  try {
    const { startDate, endDate, depositPaid, contractFiles, isActive } = req.body;
    const exists = await prisma.contract.findFirst({ where: { id: req.params.contractId, tenant: { propertyId: req.propertyId } } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบสัญญา' });
    const contract = await prisma.contract.update({
      where: { id: req.params.contractId },
      data: {
        startDate:     startDate     ? new Date(startDate) : undefined,
        endDate:       endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        depositPaid:   depositPaid   !== undefined ? depositPaid   : undefined,
        contractFiles: contractFiles !== undefined ? contractFiles : undefined,
        isActive:      isActive      !== undefined ? isActive      : undefined,
      },
      include: { room: true, tenant: true },
    });
    res.json(contract);
  } catch (e) { next(e); }
};
