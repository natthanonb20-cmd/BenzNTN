const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.list = async (req, res, next) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { propertyId: req.propertyId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(accounts);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { bankName, accountNumber, accountName } = req.body;
    if (!bankName || !accountNumber || !accountName)
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    const account = await prisma.bankAccount.create({
      data: { propertyId: req.propertyId, bankName, accountNumber, accountName },
    });
    res.status(201).json(account);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const exists = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, propertyId: req.propertyId },
    });
    if (!exists) return res.status(404).json({ error: 'ไม่พบบัญชี' });
    const { bankName, accountNumber, accountName, isActive } = req.body;
    const account = await prisma.bankAccount.update({
      where: { id: req.params.id },
      data: { bankName, accountNumber, accountName, isActive },
    });
    res.json(account);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const exists = await prisma.bankAccount.findFirst({
      where: { id: req.params.id, propertyId: req.propertyId },
    });
    if (!exists) return res.status(404).json({ error: 'ไม่พบบัญชี' });
    // unlink tenants first
    await prisma.tenant.updateMany({
      where: { bankAccountId: req.params.id },
      data: { bankAccountId: null },
    });
    await prisma.bankAccount.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
