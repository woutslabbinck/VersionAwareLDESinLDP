# Host LDP (using Version Aware LDES in LDP) 

## Introduction

Run an abstraction [LDP](https://www.w3.org/TR/ldp/) layer on top of the [LDES in LDP](https://woutslabbinck.github.io/LDESinLDP/#ldesinldp) protocol using the [Version-Aware Approach](https://woutslabbinck.github.io/LDESinLDP/#version-aware-approach).

This **LDP layer** is created as an experiment to uncover the potential of having an [LDES](https://w3id.org/ldes/specification) as storage for an `ldp:Container` with LDP RDF Sources (`ldp:RDFSource`). And to have this without having to implement the [Version-Agnostic Approach](https://woutslabbinck.github.io/LDESinLDP/#version-agnostic-approach) directly in an existing LDP (such as the [CSS](https://github.com/CommunitySolidServer/CommunitySolidServer)).

The following features on top of an LDES (in LDP) were tested:

* [snapshot](https://github.com/TREEcg/LDES-Snapshot#what-is-a-snapshot) of an LDES: Generating a `tree:Collection` which is a snapshot of the whole LDES in LDP
* [materialisation](https://semiceu.github.io/LinkedDataEventStreams/#version-materializations) of an LDES: [Materializing](https://github.com/TREEcg/version-materialize-rdf.js) the above created snapshot (or materialising a specific version of a member from the LDES in LDP)
* **A derived view** of an LDES: More specifically in this case a transformation on the snapshot of the LDES in LDP (both non-materialised and materialised) to an `ldp:container` representation where each member of the snapshot is an `ldp:RDFSource`.

## Setting everything up

Step 1: clone the VersionAwareLDESinLDP repository

```bash
git clone https://github.com/woutslabbinck/VersionAwareLDESinLDP.git
```

Step 2: Go to that directory and install everything

```bash
cd VersionAwareLDESinLDP
npm install
```

## Host the Solid Server (with metadata support)

```bash
npx @solid/community-server -p 3000 -f ./data -c "@css:config/file-no-setup.json"
```

When running this command, a solid server with metadata support is hosted at `http://localhost:3000/` with public access control. Furthermore, this solid server stores the data as files, which are located in the current `./data` directory.

## Host the LDP layer

```bash
# compile abstractLDP.ts
tsc abstractLDP.ts
# make cli executable
chmod u+x cli.js
# execute cli
./cli.js 
```

The default version runs derived and materialized. Using the options **TODO**

## Interacting with 

## TODO

- [x] Explain how to run the CSS
- [ ] Explain how to start the abstraction layer
  - [ ] Document the fields in the code that are important and which can be edited
  - [ ] explain accept-datetime link header
- [ ] maybe add this to the readme.md as an extra
- [ ] General: add resources and explanation on how everything works