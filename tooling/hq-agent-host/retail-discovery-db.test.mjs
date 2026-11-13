/** Disposable PGlite and actual synthetic CLI receipts; no hosted calls. */
import test from 'node:test'
import { verifyRetailSetup, verifyRetailAssignmentContext } from './retail-assignment-context-checks.mjs'

test('retail migration preserves old API and salon status, starts with no authority and no canonical setup',verifyRetailSetup)
test('real CLI retail trial preserves current salon history and bounded acknowledgment context',()=>verifyRetailAssignmentContext())
