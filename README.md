# VersionAwareLDESinLDP

## Using the library

### Set up

First install the packages.

```bash
# install packages
npm i
# (Optionally) set up ldp server
npx @solid/community-server -p 3000 -f ./data -c "@css:config/file-no-setup.json"
```

### Instantiating a version aware object

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
