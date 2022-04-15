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

### Configuring the LDP

| parameter name       | default value                      | description                                                  |
| -------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `--ldesinldp, -l`    | `http://localhost:3000/ldesinldp/` | The LDES in LDP base URL (if it does not exist yet, one will be initialised when the CSS was set up using port 3000) |
| `--port, -p`         | `3005`                             | The TCP port on which the server should listen.              |
| `--derived, -d`      | `false`                            | When true, a derived view of the `ldp:container` is presented at `http://localhost:$PORT/` |
| `--materialized, -m` | `true`                             | When true, all the contained resources will be materialized. |

Note: The derived view of the LDES in LDP is the LDES represented as an `ldp:container` + containment triples + the contents of the resources contained in the `ldp:container`. Without the derived view, it is just the `ldp:container` + containment triples.

## Fetching different states of a resource

Analog to the [Memento RFC](https://datatracker.ietf.org/doc/html/rfc7089), the different versions of a resource can be retrieved. 

This is achieved by using the **`Accept-Datetime`** header in the HTTP GET request, just like [Memento](https://datatracker.ietf.org/doc/html/rfc7089#section-2.1.1) does it.

An example request to the base URL:

```HTTP
GET / HTTP/1.1
Host: localhost:3005
Accept-datetime: Mon, 4 Apr 2022 15:00:00
```

Which will respond with the `ldp:container` with the resources that were available at the 4th of April 2022 at 15:00.

Currently, it is implemented that if there were no resources at that point in time, none will be returned. But I'm open for discussion about changing the behaviour and returning the oldest one always in that case accompanied with the **`Memento-Datetime`** header.