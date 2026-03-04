const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { adminAuth } = require('../middleware/auth');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const MAX_FILES = 20;
const MAX_SIZE  = 10 * 1024 * 1024; // 10 MB per file

function makeStorage(subdir) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), 'uploads', subdir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
      const name = `${subdir}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  });
}

const contractUpload = multer({
  storage: makeStorage('contracts'),
  limits:  { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED.includes(file.mimetype));
  },
});

/**
 * POST /api/upload/contracts
 * Multipart field name: "files" (up to MAX_FILES)
 * Returns: { paths: ["uploads/contracts/xxx.jpg", ...] }
 */
router.post('/contracts', adminAuth, contractUpload.array('files', MAX_FILES), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });
  const paths = req.files.map(f => `uploads/contracts/${f.filename}`);
  res.json({ paths });
});

module.exports = router;
