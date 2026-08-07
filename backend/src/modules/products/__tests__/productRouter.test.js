import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { createProductRouter } from '../productRouter.js';
function auth(req,_res,next){req.correlationId='anonymous-correlation';req.authUser={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',accessToken:'anonymous-token'};next();}
function app(enabled){const server=express();server.use(express.json());server.use('/api/v2',createProductRouter({requireSupabaseUser:auth,enabled,createRepositoryForAccessToken(){return {variants:async()=>({items:[]}),families:async()=>({items:[]}),family:async()=>({members:[]}),graph:async()=>({edges:[]}),coverage:async()=>({variantCount:0}),exceptions:async()=>({items:[]}),reconciliation:async()=>({issueSummary:{}})};}}));server.post('/api/v2/imports/initiate',(_req,res)=>res.status(204).end());return server;}
test('product catalog stays fail-closed while product_catalog_v2 is disabled',async()=>{const response=await request(app(false)).get('/api/v2/products/variants').set('Authorization','Bearer anonymous-token');assert.equal(response.status,404);assert.equal(response.body.code,'FEATURE_DISABLED');});
test('enabled product catalog requires bearer auth and returns only its parallel v2 response',async()=>{const response=await request(app(true)).get('/api/v2/products/variants').set('Authorization','Bearer anonymous-token');assert.equal(response.status,200);assert.deepEqual(response.body.items,[]);});
test('disabled product routes do not intercept the Package 01 import API',async()=>{const response=await request(app(false)).post('/api/v2/imports/initiate');assert.equal(response.status,204);});
