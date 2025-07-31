const cds = require('@sap/cds');

module.exports = srv => {
  // Helper function to save file to disk
  const saveFileToDisk = (fileName, content) => {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../uploads/receipts');

    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
    return fs.existsSync(filePath);
  };

  // Helper function to generate unique filename
  const generateFileName = (studentId, originalName, date = new Date()) => {
    const timestamp = date.getTime();
    const extension = originalName.split('.').pop();
    return `${studentId}-${timestamp}-${originalName.substring(0, originalName.lastIndexOf('.'))||originalName}.${extension}`;
  };

  // Handle student creation with receipts and files
  srv.before('CREATE', 'Students', async (req) => {
    const studentData = req.data;
    
    // If receipts are included with the student creation, handle them separately
    if (studentData.receipts && studentData.receipts.length > 0) {
      // Store receipts temporarily - they'll be processed after student is created
      req._pendingReceipts = studentData.receipts;
      delete studentData.receipts; // Remove from student data to avoid OData issues
    }
  });

  // Handle student creation after successful creation
  srv.after('CREATE', 'Students', async (data, req) => {
    if (req._pendingReceipts && req._pendingReceipts.length > 0) {
      const studentId = data.ID;
      const tx = cds.tx(req);
      
      try {
        let totalAmount = 0;
        let latestDate = null;
        
        for (const receiptData of req._pendingReceipts) {
          // Save file if present
          let fileName = null;
          if (receiptData.fileData && receiptData.fileName) {
            fileName = generateFileName(studentId, receiptData.fileName, new Date(receiptData.date));
            const fileSaved = saveFileToDisk(fileName, receiptData.fileData);
            if (!fileSaved) {
              throw new Error(`Failed to save file: ${receiptData.fileName}`);
            }
          }
          
          // Create receipt record
          await tx.run(
            INSERT.into('Receipts').entries({
              student: { ID: studentId },
              amount: receiptData.amount,
              date: receiptData.date,
              file: fileName
            })
          );
          
          totalAmount += Number(receiptData.amount);
          if (!latestDate || new Date(receiptData.date) > new Date(latestDate)) {
            latestDate = receiptData.date;
          }
        }
        
        // Update student balance and last payment date
        await tx.run(
          UPDATE.entity('Students')
            .set('balance', totalAmount)
            .set('lastPaymentAt', latestDate)
            .where({ ID: studentId })
        );
        
        await tx.commit();
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    }
  });

  // Handle student updates with receipts and files
  srv.before('UPDATE', 'Students', async (req) => {
    const studentData = req.data;
    
    // If receipts are included with the student update, handle them separately
    if (studentData.receipts && studentData.receipts.length > 0) {
      req._pendingReceipts = studentData.receipts;
      delete studentData.receipts;
    }
  });

  // Handle student updates after successful update
  srv.after('UPDATE', 'Students', async (data, req) => {
    if (req._pendingReceipts && req._pendingReceipts.length > 0) {
      const studentId = data.ID;
      const tx = cds.tx(req);
      
      try {
        // Delete existing receipts for this student
        await tx.run(DELETE.from('Receipts').where({ student_ID: studentId }));
        
        let totalAmount = 0;
        let latestDate = null;
        
        for (const receiptData of req._pendingReceipts) {
          // Save file if present and it's new (has fileData)
          let fileName = receiptData.file; // Keep existing filename if no new file
          if (receiptData.fileData && receiptData.fileName) {
            fileName = generateFileName(studentId, receiptData.fileName, new Date(receiptData.date));
            const fileSaved = saveFileToDisk(fileName, receiptData.fileData);
            if (!fileSaved) {
              throw new Error(`Failed to save file: ${receiptData.fileName}`);
            }
          }
          
          // Create receipt record
          await tx.run(
            INSERT.into('Receipts').entries({
              student: { ID: studentId },
              amount: receiptData.amount,
              date: receiptData.date,
              file: fileName
            })
          );
          
          totalAmount += Number(receiptData.amount);
          if (!latestDate || new Date(receiptData.date) > new Date(latestDate)) {
            latestDate = receiptData.date;
          }
        }
        
        // Update student balance and last payment date
        await tx.run(
          UPDATE.entity('Students')
            .set('balance', totalAmount)
            .set('lastPaymentAt', latestDate)
            .where({ ID: studentId })
        );
        
        await tx.commit();
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    }
  });

  // Legacy uploadReceipt action - keep for backward compatibility but mark as deprecated
  srv.on('uploadReceipt', async req => {
    const { studentId, amount, content } = req.data;
    const fileName = generateFileName(studentId, 'receipt.pdf');
    
    try {
      const fileSaved = saveFileToDisk(fileName, content);
      if (!fileSaved) {
        req.error(500, 'File upload failed.');
        return;
      }
      
      const tx = cds.tx(req);

      const receipt = await tx.run(
        INSERT.into('Receipts').entries({
          student: { ID: studentId },
          amount: amount,
          file: fileName,
          date: new Date()
        })
      );

      // Update student balance and last payment date
      const studentResult = await tx.run(
        SELECT.one.from('Students').where({ ID: studentId })
      );

      if (studentResult) {
        const newBalance = (studentResult.balance || 0) + parseFloat(amount);
        await tx.run(
          UPDATE.entity('Students')
            .set('balance', newBalance)
            .set('lastPaymentAt', new Date())
            .where({ ID: studentId })
        );
      }

      await tx.commit();
      return receipt;
    } catch (error) {
      req.error(500, error.message);
    }
  });

  // Add simple file download handler
  srv.on('downloadReceiptFile', async (req) => {
    const { fileName } = req.data;
    
    if (!fileName) {
      req.error(400, 'File name is required');
      return;
    }
    
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../uploads/receipts', fileName);
    
    if (!fs.existsSync(filePath)) {
      req.error(404, 'File not found');
      return;
    }
    
    try {
      const fileContent = fs.readFileSync(filePath);
      const base64Content = fileContent.toString('base64');
      
      // Try to determine MIME type from file extension
      const extension = path.extname(fileName).toLowerCase();
      let mimeType = 'application/octet-stream';
      
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };
      
      if (mimeTypes[extension]) {
        mimeType = mimeTypes[extension];
      }
      
      return {
        fileName: fileName,
        fileContent: base64Content,
        mimeType: mimeType
      };
    } catch (error) {
      req.error(500, 'Error reading file: ' + error.message);
    }
  });

  srv.after('DELETE', 'Receipts', async (data, req) => {
    const studentId = data.student_ID || (data.student && data.student.ID);
    if (!studentId) return;

    const [result] = await cds.run(
      SELECT.one`
      SUM(amount) as newBalance,
      MAX(date) as latestDate
      `.from('Receipts').where({ student_ID: studentId })
    );

    const newBalance = Number(result.newBalance) || 0;
    const latestDate = result.latestDate || null;

    await cds.run(
      UPDATE('Students')
        .set({
          balance: newBalance,
          lastPaymentAt: latestDate
        })
        .where({ ID: studentId })
    );
  });
};