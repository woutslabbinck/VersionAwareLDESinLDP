#!/usr/bin/env node
const {initiateLDESinLDP, run,readResource,readContainer,createResource,deleteResource, initialiseLDESinLDP} = require('..')
// run()
// initiateLDESinLDP("http://localhost:3123/ldesinldp/")
// initialiseLDESinLDP("http://localhost:3123/ldesinldp/")
const ldesinldpBaseIdentifier="http://localhost:3123/ldesinldp/"
readContainer(ldesinldpBaseIdentifier)
// readResource(ldesinldpBaseIdentifier, "http://example.org/resource1")
// createResource(ldesinldpBaseIdentifier, "http://example.org/resource1")
// deleteResource(ldesinldpBaseIdentifier,"http://example.org/resource5")
