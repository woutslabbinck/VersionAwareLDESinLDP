# VersionAwareLDESinLDP

The goal of this repository is to interact with an [LDES in LDP](https://woutslabbinck.github.io/LDESinLDP/index.html) with simple CRUD (Create, Read, Update and Read) operations.

This library has been tested with the Community Solid Server (CSS).

## How does it work

The class `VersionAwareLDESinLDP` is an implementation of dealing with a versioned LDES in LDP.

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

The three main features **initialising**, **appending a member** and **creating a new fragment** are implemented through their respective function `initialise`, `create` and `newFragment`.
However, adding the version triple and time triple to append a member to the LDES in LDP is not done in the `create` function.

## Using the library

### Set up

First install the packages.

```bash
# install packages
npm i
# (Optionally) set up a solid server
npx @solid/community-server -p 3000 -f ./data -c "@css:config/file-no-setup.json"
```

### Initialising an LDES in LDP

```javascript
const {LDPCommunication, LDESinLDP, VersionAwareLDESinLDP} = require('@treecg/versionawareldesinldp');
const ldesinldpIdentifier = 'http://localhost:3000/ldesinldp/'; // Base URL of the LDES in LDP 
const communication = new LDPCommunication();
const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
const versionAware = new VersionAwareLDESinLDP(ldesinldp);

# initialise
await versionAware.initialise(ldesinldpIdentifier)
```

From this point, this initialised LDES in LDP will be used through `versionAware`  in the next code examples unless stated otherwise.

### What is created?

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

### Create a version object

I want to store a resource (following triple`:resourcev1 http://purl.org/dc/terms/title "Title" .` ) to the LDES in LDP and want to later read it with an identifier (`http://example.org/resource1`).

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

I want to read the resource that has been written

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

```javascript
store.addQuad(namedNode(memberIdentifier), namedNode('http://purl.org/dc/terms/title'), literal('Fancy Title'));
await versionAware.update(versionID, store, memberIdentifier);
```

### Delete a version object

```javascript
await versionAware.delete(versionID);
```

### Reading all the versions

```javascript
// I want to view all the changes to the resource from the start
const options = {
    amount:Infinity, 
    chronologically: true
}
const resources = await versionAware.extractVersions(versionID, options)

for (const resource of resources) {
    console.log(storeToString(new Store(resource.quads)))
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



# Old

### Instantiating a version aware object

#### Unauthenticated

```javascript
const {versionAwareLDESinLDP} = require('@treecg/versionawareldesinldp');
const ldesinldpIdentifier = 'http://localhost:3000/ldesinldp/'; // Base URL of the LDES in LDP 
const versionAware = await versionAwareLDESinLDP(ldesinldpIdentifier);
```

Which is some sugar (which uses [components.js](https://github.com/LinkedSoftwareDependencies/Components.js) + config
files) for the following code:

```javascript
const {LDPCommunication, LDESinLDP, VersionAwareLDESinLDP} = require('@treecg/versionawareldesinldp');
const ldesinldpIdentifier = 'http://localhost:3000/ldesinldp/'; // Base URL of the LDES in LDP 
const communication = new LDPCommunication();
const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
const versionAware = new VersionAwareLDESinLDP(ldesinldp);
```

#### Authenticated
```javascript
const {LDPCommunication, LDESinLDP, VersionAwareLDESinLDP} = require('@treecg/versionawareldesinldp');
const session = ...; // Get a login session (@inrupt/solid-client-authn-node or @inrupt/solid-client-authn-browser)
const ldesinldpIdentifier = 'http://localhost:3000/ldesinldp/'; // Base URL of the LDES in LDP 
const communication = new LDPCommunication(session);
const ldesinldp = new LDESinLDP(ldesinldpIdentifier, communication);
const versionAware = new VersionAwareLDESinLDP(ldesinldp);
```
##### Session
There is a provided way to get a session (this way doesn't need to be use however).
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

### Initialising the LDES in LDP

````javascript
await versionAware.initialise(ldesinldpIdentifier);
````

### Creating a resource

```javascript
const {Store, DataFactory} = require("n3");
const namedNode = DataFactory.namedNode;
const literal = DataFactory.literal;
const store = new Store();
const versionID = '#resource'; // could also be a full IRI e.g. http://example.org/resource1v1 
const materializedID = 'http://example.org/resource1';
store.addQuad(namedNode(versionID), namedNode('http://purl.org/dc/terms/title'), literal('Title'));
await versionAware.create(materializedID, store, versionID);
```

### Reading

#### Materialized Resource
```javascript
const materializedID = 'http://example.org/resource1';
const store = await versionAware.read(materializedID);
```

Printing the received store

```javascript
const Writer = require("n3").Writer;
const writer = new Writer();
console.log(writer.quadsToString(store.getQuads()));
```

Which results into:

```turtle
<http://example.org/resource1> <http://purl.org/dc/terms/title> "Title".
```

#### Non-materialized Resource
For this, some options have to be passed as an object

There are three parameters in the options object: date, materialized and derived.
The **default** is given below (which means without passing an options object, this will be used).
```javascript
const options = {
  date: new Date(), // date that is used to create a snapshot of the resources in LDES
  materialized: true, // whether the snapshot is materialized or not
  derived: false // only applicable in the use case when the resource is a container. Thus this parameter decides whether the container is derived or not
}
```

Reading a resource non-materialized is thus called as follows:
```javascript
await versionAware.read(materializedID, {
  date: new Date(),
  materialized: false,
  derived: false
})
```

Which in this case will be the following:
```turtle
<http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> <http://purl.org/dc/terms/title> "Title" .
<http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> <http://purl.org/dc/terms/isVersionOf> <http://example.org/resource1> .
<http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> <http://purl.org/dc/terms/created> "2022-03-31T15:20:17.844Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .

```

#### Containers
There are four different configurations that can be obtained (with any date) for reading containers by passing options when reading
In the following table, the configurations and corresponding container name is explained:


| Container name                 | derived | materialized |
|--------------------------------|---------|--------------|
| Container                      | false   | false        |
| Materialized Container         | false   | true         |
| Derived Container              | true    | false        |
| Derived Materialized Container | true    | true         |

An example request with options is thus the following: (Note: this is the Container representation)

```javascript
await versionAware.read(materializedID, {
  date: new Date(),
  materialized: false,
  derived: false
})
```

For each configuration the result of reading (printed as n-quads) is shown below:

Container representation
```turtle
<http://localhost:3000/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/ldp#BasicContainer> .
<http://localhost:3000/ldesinldp/> <http://www.w3.org/ns/ldp#contains> <http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> .
```

Materialized Container representation
```turtle
<http://localhost:3000/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/ldp#BasicContainer> .
<http://localhost:3000/ldesinldp/> <http://www.w3.org/ns/ldp#contains> <http://example.org/resource1> .
```

Derived Container representation
```turtle
<http://localhost:3000/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/ldp#BasicContainer> .
<http://localhost:3000/ldesinldp/> <http://www.w3.org/ns/ldp#contains> <http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> .
<http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> <http://purl.org/dc/terms/title> "Title" .
<http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> <http://purl.org/dc/terms/isVersionOf> <http://example.org/resource1> .
<http://localhost:3000/ldesinldp/1648479208841/570f0194-adbc-409b-b343-1622a802ee56#resource> <http://purl.org/dc/terms/created> "2022-03-31T15:20:17.844Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
```

Derived materialized Container representation
```turtle
<http://localhost:3000/ldesinldp/> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/ns/ldp#BasicContainer> .
<http://localhost:3000/ldesinldp/> <http://www.w3.org/ns/ldp#contains> <http://example.org/resource1> .
<http://example.org/resource1> <http://purl.org/dc/terms/title> "Title" .
```

## LDP layer on top of the VersionAwareLDES in LDP library

Run an abstraction [LDP](https://www.w3.org/TR/ldp/) layer on top of the [LDES in LDP](https://woutslabbinck.github.io/LDESinLDP/#ldesinldp) protocol using the [Version-Aware Approach](https://woutslabbinck.github.io/LDESinLDP/#version-aware-approach).

How to do that is explained in the [Host LDP.md](./Host%20LDP.md) Markdown document.
