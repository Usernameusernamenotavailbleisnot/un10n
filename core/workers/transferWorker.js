// core/workers/transferWorker.js
import { parentPort, workerData } from 'worker_threads';
import { createWalletLogger } from '../../utils/logger.js';
import TransferFactory from '../blockchain/transfers/transferFactory.js';
import ProgressService from '../progress/progress.js';
import { sleep } from '../../utils/common.js';

// Create worker logger
const logger = createWalletLogger(workerData.walletIndex);

// Worker entry point
async function processTransfer() {
  logger.info(`Worker ${workerData.workerId}: Starting transfer for wallet ${workerData.walletIndex + 1}`);
  
  try {
    // Get the data from workerData
    const {
      walletIndex,
      privateKey,
      sourceChain,
      destinationChain,
      receiverAddress,
      amount,
      config,
      transferType
    } = workerData;

    logger.info(`Processing transfer from ${sourceChain} to ${destinationChain}`);
    
    // Create transfer factory
    const transferFactory = new TransferFactory(config, walletIndex, privateKey);
    
    // Create transfer according to type
    const transfer = transferFactory.createTransfer(transferType);
    
    // Execute transfer
    const result = await transfer.transfer(receiverAddress, amount);
    
    // If transfer was successful, update progress
    if (result && result.success) {
      // Update progress
      const progressService = new ProgressService(walletIndex);
      
      // Update different progress metrics based on the type of transfer
      if (workerData.updateProgress) {
        if (workerData.isDaily) {
          await progressService.updateDailyInteraction(destinationChain, new Date().toISOString().split('T')[0]);
        } else if (workerData.isCrossChain) {
          // Cross-chain quest progress is updated after all transfers complete
        } else {
          await progressService.updateTransferCount(destinationChain);
        }
      }
      
      // Let the main thread know about the success
      parentPort.postMessage({
        success: true,
        result: result
      });
    } else {
      // Send the error back to the main thread
      parentPort.postMessage({
        success: false,
        error: result?.error || "Transfer failed with no specific error"
      });
    }
  } catch (error) {
    logger.error(`Worker ${workerData.workerId}: Error processing transfer: ${error.message}`);
    
    // Send error back to the main thread
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  }
}

// Start processing
processTransfer().catch(error => {
  logger.error(`Worker encountered an unhandled error: ${error.message}`);
  if (error.stack) {
    logger.error(`Stack trace: ${error.stack}`);
  }
  
  // Send error back to the main thread
  parentPort.postMessage({
    success: false,
    error: error.message
  });
});