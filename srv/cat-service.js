const FileManager = require('./utils/FileManager');

module.exports = srv => {
  srv.on('uploadReceipt', async req => {
    try {
      if (!req.data || !req.data.content) {
        req.error(400, 'Content is required');
        return;
      }

      const fileName = `receipt_${Date.now()}.jpg`;
      const content = req.data.content;

      const validation = FileManager.validateFile(fileName, content);
      if (!validation.isValid) {
        req.error(400, `File validation failed: ${validation.error}`);
        return;
      }

      const uniqueFileName = FileManager.generateFileName(fileName);
      const saveResult = FileManager.saveFile(uniqueFileName, content);
      
      if (!saveResult.success) {
        req.error(500, `File upload failed: ${saveResult.error}`);
        return;
      }
      
      return { filePath: uniqueFileName };
    } catch (error) {
      console.error('Error in uploadReceipt:', error);
      req.error(500, `Upload failed: ${error.message}`);
    }
  });

  srv.on('downloadReceipt', async (req) => {
    const { fileName } = req.data;
    
    if (!fileName) {
      req.error(400, 'File name is required');
      return;
    }
    
    try {
      const result = FileManager.readFile(fileName);
      
      if (!result.success) {
        const errorCode = result.error === 'File not found' ? 404 : 500;
        req.error(errorCode, result.error);
        return;
      }
      
      return {
        fileName: result.fileName,
        fileContent: result.fileContent,
        mimeType: result.mimeType
      };
    } catch (error) {
      console.error('Error in downloadReceiptFile:', error);
      req.error(500, `Download failed: ${error.message}`);
    }
  });

  srv.on('deleteReceipt', async (req) => {
    const { fileName } = req.data;
    
    if (!fileName) {
      req.error(400, 'File name is required');
      return;
    }
    
    try {
      const result = FileManager.deleteFile(fileName);
      
      if (!result.success) {
        const errorCode = result.error === 'File not found' ? 404 : 500;
        req.error(errorCode, result.error);
        return;
      }
      
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      console.error('Error in deleteReceipt:', error);
      req.error(500, `Delete failed: ${error.message}`);
    }
  });
};