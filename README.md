# VersionAwareLDESinLDP

[![npm](https://img.shields.io/npm/v/@treecg/versionawareldesinldp)](https://www.npmjs.com/package/@treecg/versionawareldesinldp)

The goal of this repository is to interact with an [LDES in LDP](https://woutslabbinck.github.io/LDESinLDP/index.html) with simple CRUD (Create, Read, Update and Read) operations.

This library has been tested with the Community Solid Server (CSS).

## How does it work

The class `VersionAwareLDESinLDP` is an implementation of dealing with a versioned time-based LDES in LDP.

It provides functions to **initialise** a versioned LDES in LDP and **create**, **read**, **update** and **delete**\* a member in the LDES in LDP using the version identifier.
**Functions**:

* `create(versionID, store)` appends the contents of the N3 store to the LDES in LDP.
  * also checks whether the versionID exists already. If it does, will throw an error
* `update(versionID, store)` appends the contents of the N3 store to the LDES in LDP.
* `read(versionID)` returns the most recent member with that version identifier.
* `delete(versionID)`uses the read method as member and adds a triple that marks the resource as deleted.
* `extractVersions(VersionID)` extracts the different versions using the version identifier within the LDES in LDP

\*With deleting is meant that the resource is just marked as delete and not actually removed from the LDES (remember that all members of an LDES are *immutable*)

The class `LDESinLDP` is an implementation of the LDES in LDP protocol.  This class is used within `VersionAwareLDESinLDP` and provides some utilities.

The three main features **initialising**, **appending a member** and **creating a new fragment** are implemented through their respective function `initialise`, `append` and `newFragment`.
However, adding the version triple and time triple to append a member to the LDES in LDP is not done in the `append` function.

## Using the library

### Set up

First install the packages.

```bash
# install packages
npm i @treecg/versionawareldesinldp
# (Optionally) set up a solid server
npx @solid/community-server -p 3000 -f ./data -c "@css:config/file-no-setup.json"
# or one without file system
npx @solid/community-server -c test/util/memory-no-setup.json
```

### Initialising an LDES in LDP

```javascript
const {LDPCommunication, LDESinLDP, VersionAwareLDESinLDP} = require('@treecg/versionawareldesinldp');
const ldesinldpIdentifier = 'http://localhost:3000/ldesinldp/'; // Base URL of the LDES in LDP 
const communication = new LDPCommunication();
const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
const versionAware = new VersionAwareLDESinLDP(ldesinldp);

// initialise
await versionAware.initialise(ldesinldpIdentifier)
```

From this point, this initialised LDES in LDP will be used through `versionAware`  in the next code examples unless stated otherwise.

### What is created?

<details>
<summary>Click here</summary>

```
- localhost:3000/
 |- ldesinldp/
  |- {timestamp}/
```

In the container at URL `http://localhost:3000/`, the `ldesinldp` is created.
Furthermore, the ldes is described in there in that container. Which can be verified by sending a `GET` request

```sh
curl http://localhost:3000/ldesinldp/
```

```turtle
@prefix dc: <http://purl.org/dc/terms/> .
@prefix ldp: <http://www.w3.org/ns/ldp#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix tree: <https://w3id.org/tree#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ldes: <http://w3id.org/ldes#>.

<http://localhost:3000/ldesinldp/> dc:modified "2022-09-29T13:23:30.000Z"^^xsd:dateTime ;
    rdf:type ldp:BasicContainer , ldp:Container , ldp:Resource , tree:Node ;
    ldp:contains <http://localhost:3000/ldesinldp/1664457810373/> ;
    ldp:inbox <http://localhost:3000/ldesinldp/1664457810373/> ;
    tree:relation [
        rdf:type tree:GreaterThanOrEqualToRelation ;
        tree:node <http://localhost:3000/ldesinldp/1664457810373/> ;
        tree:path dc:created ;
        tree:value "2022-09-29T13:23:30.373Z"^^xsd:dateTime
    ] .

<http://localhost:3000/ldesinldp/#EventStream> rdf:type ldes:EventStream ;
    ldes:timestampPath dc:created ;
    ldes:versionOfPath dc:isVersionOf ;
    tree:view <http://localhost:3000/ldesinldp/> .
```
</details>

### Create a version object

I want to store a resource (following triple`:resourcev1 http://purl.org/dc/terms/title "Title" .` ) to the LDES in LDP and want to later read it with an identifier (`http://example.org/resource1`).

This is done with the function `create` which allows to append a new version object to the LDES in LDP.

```javascript
const {Store, DataFactory} = require("n3");
const namedNode = DataFactory.namedNode;
const literal = DataFactory.literal;
const store = new Store();

const memberIdentifier = '#resource'; // could also be a full IRI e.g. http://example.org/resource1v1 
const versionID = 'http://example.org/resource1';
store.addQuad(namedNode(memberIdentifier), namedNode('http://purl.org/dc/terms/title'), literal('Title'));
await versionAware.create(versionID, store, memberIdentifier);
```

### Read a version object

I want to read the resource that has been written.

The function `read` extracts the latest version of the version object and returns it as an N3 Store.

```javascript
const {storeToString} = require('@treecg/versionawareldesinldp'); // utility function to convert a Store to a string

const resource = await versionAware.read(versionID);
console.log(storeToString(resource))
```

Which outputs

```turtle
<http://localhost:3000/ldesinldp/1664457810373/f982b7f3-c1e6-4a9a-8c0c-f7f40e98f638#resource> <http://purl.org/dc/terms/title> "Title" .
<http://localhost:3000/ldesinldp/1664457810373/f982b7f3-c1e6-4a9a-8c0c-f7f40e98f638#resource> <http://purl.org/dc/terms/isVersionOf> <http://example.org/resource1> .
<http://localhost:3000/ldesinldp/1664457810373/f982b7f3-c1e6-4a9a-8c0c-f7f40e98f638#resource> <http://purl.org/dc/terms/created> "2022-09-29T13:33:16.932Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
```

### Update a version object

I want to change the title of my resource to `Fancy Title.`

The function `update` stores a new version of this version object to the LDES in LDP.

```javascript
store.addQuad(namedNode(memberIdentifier), namedNode('http://purl.org/dc/terms/title'), literal('Fancy Title'));
await versionAware.update(versionID, store, memberIdentifier);
```

### Delete a version object

The function `delete` marks a members as deleted. 
For this, it copies the latest version object and adds a triple to indicate this deletion.

```javascript
await versionAware.delete(versionID);
```

### Reading all the version objects 

The function `extractVersions` retrieves all members with a given version identifier. 

```javascript
const options = {
    amount:Infinity, // I want all members
    chronologically: true // the members are sorted from oldest to newest
} // It is also possible retrieve all members within a window by giving a `startDate` and `endDate` argument

// extractVersions extracts all members with a given version identifier constrained by the options
const resources = await versionAware.extractVersions(versionID, options)

for (const resource of resources) {
    console.log(storeToString(new Store(resource.quads)))
}
```

In the output, the three different stages can clearly be seen:

1. We created a resource with a title: "Title"
2. Later, this resource its contents are completely rewritten with as result that it now has a title: "Fancy Title"
3. Finally with the triple `<...#resource> a ldes:DeletedLDPResource`, we've marked this resource as deleted.

```turtle
<http://localhost:3000/ldesinldp/1664457810373/f982b7f3-c1e6-4a9a-8c0c-f7f40e98f638#resource> <http://purl.org/dc/terms/title> "Title" .
<http://localhost:3000/ldesinldp/1664457810373/f982b7f3-c1e6-4a9a-8c0c-f7f40e98f638#resource> <http://purl.org/dc/terms/isVersionOf> <http://example.org/resource1> .
<http://localhost:3000/ldesinldp/1664457810373/f982b7f3-c1e6-4a9a-8c0c-f7f40e98f638#resource> <http://purl.org/dc/terms/created> "2022-09-29T13:33:16.932Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .

<http://localhost:3000/ldesinldp/1664457810373/5f8119f6-649c-4fea-8b4a-daf979e1a362#resource> <http://purl.org/dc/terms/title> "Fancy Title" .
<http://localhost:3000/ldesinldp/1664457810373/5f8119f6-649c-4fea-8b4a-daf979e1a362#resource> <http://purl.org/dc/terms/isVersionOf> <http://example.org/resource1> .
<http://localhost:3000/ldesinldp/1664457810373/5f8119f6-649c-4fea-8b4a-daf979e1a362#resource> <http://purl.org/dc/terms/created> "2022-09-29T14:08:58.602Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .

<http://localhost:3000/ldesinldp/1664457810373/4bc6fa4d-7b99-41aa-a289-ba3823223045#resource> <http://purl.org/dc/terms/title> "Fancy Title" .
<http://localhost:3000/ldesinldp/1664457810373/4bc6fa4d-7b99-41aa-a289-ba3823223045#resource> <http://purl.org/dc/terms/isVersionOf> <http://example.org/resource1> .
<http://localhost:3000/ldesinldp/1664457810373/4bc6fa4d-7b99-41aa-a289-ba3823223045#resource> <http://purl.org/dc/terms/created> "2022-09-29T14:08:58.690Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
<http://localhost:3000/ldesinldp/1664457810373/4bc6fa4d-7b99-41aa-a289-ba3823223045#resource> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://w3id.org/ldes#DeletedLDPResource> .
```

### Authenticated LDES in LDP

A private LDES in LDP can be created by using `SolidCommunication` and a `Session` (from [solid-client-authn-js](https://github.com/inrupt/solid-client-authn-js) ).

```javascript
const {SolidCommunication, LDESinLDP, VersionAwareLDESinLDP} = require('@treecg/versionawareldesinldp');
const session = ...; // Get a login session (@inrupt/solid-client-authn-node or @inrupt/solid-client-authn-browser)
const ldesinldpIdentifier = 'http://localhost:3000/ldesinldp/'; // Base URL of the LDES in LDP 
const communication = new SolidCommunication(session);
const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
const versionAware = new VersionAwareLDESinLDP(ldesinldp);
```

#### Getting a Session

The following code can be used to retrieve a Session if you are working with javascript node.

```javascript
const {login, isLoggedin, getSession} = require('@treecg/versionawareldesinldp')

const validatedOptions = {
    applicationName: "LDES-orchestrator",
    registrationType: "dynamic",
    solidIdentityProvider: "http://localhost:3000"
};

await login(validatedOptions);
await isLoggedin(); // code that checks whether you are already logged in
const session = await getSession();
```

## Feedback and questions

Do not hesitate to [report a bug](https://github.com/woutslabbinck/VersionAwareLDESinLDP/issues).

Further questions can also be asked to [Wout Slabbinck](mailto:wout.slabbinck@ugent.be) (developer and maintainer of this repository).
