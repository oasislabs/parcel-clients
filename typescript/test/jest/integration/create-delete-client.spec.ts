import type { App, Client, Parcel } from '../../..'; // eslint-disable-line import/extensions
import { bootstrapParcel, createAppAndClient } from './helpers';

describe('Client', () => {
  let parcel: Parcel;
  let app: App;
  let client: Client;

  it('bootstrap', async () => {
    parcel = await bootstrapParcel();
  });

  it('create', async () => {
    const created = await createAppAndClient(parcel);
    app = created.app;
    client = created.client;
  });

  it('delete', async () => {
    await client.delete();
    await expect(parcel.getClient(app.id, client.id)).rejects.toThrow('not found');
    await app.delete();
    await expect(parcel.getApp(app.id)).rejects.toThrow('not found');
  });
});
