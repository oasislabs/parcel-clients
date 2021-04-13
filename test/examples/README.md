# Tests for Parcel Examples

This folder contains end-to-end tests for the typescript client examples and a tests spawner.

To test the examples:

1. Spin up local Parcel Development stack as described in [apps readme](../../../../../apps/README.md).

2. Some tests require cypress. Install cypress and cypress dependencies. On a typical Debian-like
   system this would look something like this:

```shell
cd gateway/clients/typescript
npm i # cypress is defined as devDependency, this will install it locally
apt update && apt install -y libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb
```

3. Install dependencies of each example and configure npm to use the local version of Parcel
   typescript client. Something like this:

```shell
cd gateway/clients/typescript/examples
for example_name in *; do
    cd ${example_name}
    npm i
    npm install ../..
    cd ..
done
```

4. Execute the tests. Don't forget to provide PARCEL_API_URL with the address of your parcel gateway
   and PARCEL_AUTH_URL with the auth proxy address. If you use the Parcel Development Stack from the
   first step, this should work:

```shell
cd gateway/clients/typescript
NODE_TLS_REJECT_UNAUTHORIZED=0 PARCEL_API_URL=http://localhost:4242/v1 PARCEL_AUTH_URL=https://parcel-sdk-dev-local.oasislabs:9002 yarn jest examples
```

This will launch the tests spawner. Initially it will create two apps using the self-signed entity
and with some frontend, backend, and service clients in each. Then, the spawner will execute `npm start`
on each of the examples and perform test-specific actions in parallel.

Some examples (e.g. data-upload, compute-basic, compute-advanced) are tested by simply executing the
example and waiting for it to successfully finish. Others (e.g. data-access) capture tests output and
perform some actions (e.g. allow access to some document). Most comprehensive tests (e.g. login-with-oasis*)
are first spun up, then tested with cypress, and finally shut down.
