#!/bin/bash
usage() {
    cat <<EOM
Usage: $(basename "$0") [--check]

This script goes through all Node.js examples of the TypeScript client and
syncs the version of @oasislabs/parcel dependency with the one in the local
TypeScript client package.json. In addition, it clears node_modules/ and
generates a fresh package-lock.json for each example.

If --check parameter is provided, it only checks whether the versions and
lock files match and returns a non-zero code, if they do not.

NOTE: Make sure node_modules folder in your TypeScript client is clean (rm -r
node_modules; yarn). Otherwise leftover dependencies will blow up newly
generated package-lock.json files.
EOM
  exit 1
}

set -euo pipefail

tsclient_dir=$(realpath "$(dirname "$0")"/..)

check_only=false
has_errors=false
if [[ $# -gt 0 ]]; then
  if [[ $# != 1 || $1 != "--check" ]]; then
    usage
  fi

  check_only=true
fi

parcel_version=$(jq -r '.version' "$tsclient_dir/package.json")
parcel_npmpacked=false
if [[ ! "$parcel_version" || "$parcel_version" == "null" ]]; then
  echo "error: failed to obtain TypeScript client version, aborting"
  exit 1
fi

pushd "$tsclient_dir/examples" >/dev/null
for example_packagejson in */package.json; do
  e=$(dirname "$example_packagejson")
  pushd "$e" >/dev/null

  example_version=$(jq -r '.dependencies["@oasislabs/parcel"]' "package.json")
  example_lock_version=""
  if [[ -f package-lock.json ]]; then
    example_lock_version=$(jq -r '.dependencies["@oasislabs/parcel"].version' "package-lock.json")
  fi

  if [[ "${example_version}" == "^${example_lock_version}" && "^${parcel_version}" == "${example_version}" ]]; then
    popd >/dev/null
    continue
  fi

  if $check_only; then
    if [[ "^${parcel_version}" != "${example_version}" ]]; then
      echo "error: \"$e\" example has inconsistent @oasislabs/parcel version. \"${example_version}\" does not match local TypeScript client version \"${parcel_version}\""
      has_errors=true
    fi

    if [[ -z "${example_lock_version}" ]]; then
      echo "error: \"$e\" example is missing package-lock.json"
      has_errors=true
    elif [[ "${example_version}" != "^${example_lock_version}" ]]; then
      echo "error: \"$e\" example has inconsistent package.json and package-lock.json files. ${example_version} does not match ${example_lock_version}."
      has_errors=true
    fi
  else
    # We cannot simply npm i @oasislabs/parcel@${parcel_version} to sync
    # package.json and package-lock.json with TS client, because it's not
    # being deployed yet. Instead we pack the local version of TS client and
    # install it from the file in the example.
    if ! $parcel_npmpacked; then
      pushd "$tsclient_dir/examples" >/dev/null
      npm pack ..
      popd >/dev/null
      parcel_npmpacked=true
    fi

    rm -rf node_modules package-lock.json
    npm i "$tsclient_dir/examples/oasislabs-parcel-${parcel_version}.tgz" && npm i

    # We replace "@oasislabs/parcel": "file:../../oasislabs-parcel-<someversion>.tgz"
    # with "<someversion>" in package.json and package-lock.json.
    jq -r ".dependencies[\"@oasislabs/parcel\"] |= \"^${parcel_version}\"" package.json > .package.json && mv .package.json package.json
    jq -r ".dependencies[\"@oasislabs/parcel\"].version |= \"${parcel_version}\"" package-lock.json > .package-lock.json && mv .package-lock.json package-lock.json
  fi

  popd >/dev/null
done
popd >/dev/null

if $parcel_npmpacked; then
    pushd "$tsclient_dir/examples" >/dev/null
    rm "oasislabs-parcel-${parcel_version}.tgz"
    popd >/dev/null
fi

if $has_errors; then
  echo "error: Inconsistent @oasislabs/parcel version in examples. Try running ${BASH_SOURCE[0]} without --check flag to sync the versions. Aborting."
  exit 1
fi
