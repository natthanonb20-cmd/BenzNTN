const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.list = async (req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { propertyId: req.propertyId, isActive: true },
      include: {
        contracts: {
          where: { isActive: true },
          include: { tenant: true },
          take: 1,
        },
      },
      orderBy: { roomNumber: 'asc' },
    });
    res.json(rooms);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const room = await prisma.room.findFirstOrThrow({
      where: { id: req.params.id, propertyId: req.propertyId },
    });
    res.json(room);
  } catch (e) { next(e); }
};

/** checkSubscription + checkRoomLimit run BEFORE this via route middleware */
exports.create = async (req, res, next) => {
  try {
    const { roomNumber, monthlyRent, customElectricRate, customWaterRate, commonFee, furnitureFee, parkingFee, description } = req.body;
    const room = await prisma.room.create({
      data: {
        propertyId: req.propertyId,
        roomNumber,
        monthlyRent,
        customElectricRate: customElectricRate ? Number(customElectricRate) : null,
        customWaterRate:    customWaterRate    ? Number(customWaterRate)    : null,
        commonFee:          commonFee          ? Number(commonFee)          : null,
        furnitureFee:       furnitureFee       ? Number(furnitureFee)       : null,
        parkingFee:         parkingFee         ? Number(parkingFee)         : null,
        description,
      },
    });
    res.status(201).json(room);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { roomNumber, monthlyRent, customElectricRate, customWaterRate, commonFee, furnitureFee, parkingFee, description, isActive } = req.body;
    // ตรวจสอบว่าห้องนี้เป็นของ property นี้ก่อนแก้ไข
    const room = await prisma.room.update({
      where:  { id: req.params.id, propertyId: req.propertyId },
      data: {
        roomNumber,
        monthlyRent,
        customElectricRate: customElectricRate !== undefined ? (customElectricRate ? Number(customElectricRate) : null) : undefined,
        customWaterRate:    customWaterRate    !== undefined ? (customWaterRate    ? Number(customWaterRate)    : null) : undefined,
        commonFee:          commonFee          !== undefined ? (commonFee          ? Number(commonFee)          : null) : undefined,
        furnitureFee:       furnitureFee       !== undefined ? (furnitureFee       ? Number(furnitureFee)       : null) : undefined,
        parkingFee:         parkingFee         !== undefined ? (parkingFee         ? Number(parkingFee)         : null) : undefined,
        description,
        isActive,
      },
    });
    res.json(room);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    await prisma.room.update({
      where: { id: req.params.id, propertyId: req.propertyId },
      data:  { isActive: false },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
