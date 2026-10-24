import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

// Change listener is required for drizzle's useLiveQuery to refresh the document list.
const expoDb = openDatabaseSync('panna.db', { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });
