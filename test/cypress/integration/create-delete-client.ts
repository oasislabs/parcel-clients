/// <reference types="../fixtures/types" />
import type { App, Client, Parcel } from '../../..'; // eslint-disable-line import/extensions
import { bootstrapParcel } from './helpers';

describe('Client', () => {
  let parcel: Parcel;
  let app: App;
  let client: Client;

  it('bootstrap', async () => {
    parcel = await bootstrapParcel();
  });

  it('create', async () => {
    app = await parcel.createApp({
      admins: [],
      allowUserUploads: false,
      collaborators: [],
      homepageUrl: 'https://oasislabs.com',
      identity: {
        tokenVerifiers: [],
      },
      inviteOnly: false,
      invites: [],
      logoUrl: 'https://oasislabs.com',
      name: 'a',
      organization: '',
      privacyPolicy: 'https://oasislabs.com',
      published: true,
      shortDescription: '',
      termsAndConditions: 'https://oasislabs.com',
      acceptanceText: '',
      brandingColor: '',
      category: '',
      extendedDescription: '',
      invitationText: '',
      rejectionText: '',
    });
    client = await parcel.createClient(app.id, {
      type: ClientType.Frontend,
      name: 'a',
      redirectUris: ['https://oasislabs.com'],
      postLogoutRedirectUris: ['https://oasislabs.com'],
    });
  });

  it('delete', async () => {
    await client.delete();
    await app.delete();
  });
});
