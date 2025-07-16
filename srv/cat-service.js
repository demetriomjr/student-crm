const cds = require('@sap/cds');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadReceiptsFolder = path.resolve(__dirname, '../uploads/receipts');


if (!fs.existsSync(uploadReceiptsFolder)) {
  fs.mkdirSync(uploadReceiptsFolder, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadReceiptsFolder),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

module.exports = srv => {

  srv.on('uploadReceipt', async (req) => {
    const { studentId, receiptFile, amount } = req.data;

    const result = await cds.tx(req).run(
      INSERT.into('Receipts').entries({
        student: { ID: studentId },
        amount: amount,
        file: receiptFile,
        date: new Date()
      })
    );
    return { message: 'Receipt uploaded', receipt: result };
  });

  cds.on('bootstrap', app => {
    app.post('/students/uploadReceipt', upload.single('file'), async (req, res) => {
      try {
        const { studentId, amount } = req.body;
        const fileName = req.file.filename;
        const tx = cds.tx(req);
        const receipt = await tx.run(
          INSERT.into('Receipts').entries({
            student: { ID: studentId },
            amount: amount,
            file: fileName,
            date: new Date()
          })
        );
        res.status(201).json({ message: 'Upload successful', receipt });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.use('/uploads', require('express').static(path.resolve(__dirname, '../uploads')));
  });
};