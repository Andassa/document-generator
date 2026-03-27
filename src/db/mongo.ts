import mongoose from 'mongoose';
import { config } from '../config';
import { rootLogger } from '../utils/logger';

export async function connectMongo(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.MONGODB_URI);
    rootLogger.info('Connexion MongoDB établie');
  } catch (err) {
    rootLogger.error('Échec connexion MongoDB', { err });
    throw err;
  }
}

export async function disconnectMongo(): Promise<void> {
  try {
    await mongoose.disconnect();
    rootLogger.info('MongoDB déconnecté');
  } catch (err) {
    rootLogger.error('Erreur lors de la déconnexion MongoDB', { err });
    throw err;
  }
}
