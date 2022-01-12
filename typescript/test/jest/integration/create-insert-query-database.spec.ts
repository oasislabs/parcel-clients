import type { Database, Parcel } from '../../..'; // eslint-disable-line import/extensions
import { bootstrapParcel } from './helpers';

describe('Client', () => {
  let parcel: Parcel;
  let database: Database;

  it('bootstrap', async () => {
    parcel = await bootstrapParcel();
  });

  it('create', async () => {
    database = await parcel.createDatabase({ name: 'Recipe Database' });
    await parcel.queryDatabase(database.id, {
      sql: 'CREATE TABLE threat_intels (wallet TEXT, inner TEXT, level INTEGER, data JSON)',
      params: {},
    });
  });

  it('insert', async () => {
    await parcel.insertRows(database.id, {
      tableName: 'threat_intels',
      rows: [
        {
          wallet: '0x1234',
          inner: 'safe',
          level: 3,
          data: {
            extra: null,
          },
        },
        {
          wallet: '0x4567',
          inner: 'unsafe',
          level: 8,
          data: {
            extra: {
              origin: 'apple',
            },
          },
        },
      ],
    });
  });

  it('delete', async () => {
    await parcel.deleteDatabase(database.id);
    await expect(parcel.getDatabase(database.id)).rejects.toThrow('not found');
  });
});
