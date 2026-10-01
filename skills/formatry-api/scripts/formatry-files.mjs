#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://formatry.cc/api/mcp/transfers/file';
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_STDIN_BYTES = 16384;
const MIME_TYPES = { '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.avif':'image/avif', '.gif':'image/gif', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.otf':'font/otf', '.woff':'font/woff', '.woff2':'font/woff2' };
const fail = code => { throw new Error(code); };
const inside = (root, file) => { const rel=path.relative(root,file); return rel !== '..' && !rel.startsWith('..'+path.sep) && !path.isAbsolute(rel); };

async function readLocal(file, root) {
  root=await fs.realpath(root);
  const resolved=await fs.realpath(path.resolve(root,file));
  if(!inside(root,resolved)) fail('FILE_OUTSIDE_WORKSPACE');
  const info=await fs.lstat(resolved);
  if(!info.isFile()) fail('REGULAR_FILE_REQUIRED');
  const handle=await fs.open(resolved,constants.O_RDONLY | (constants.O_NOFOLLOW??0));
  try {
    const stat=await handle.stat();
    if(!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) fail('FILE_SIZE_UNSUPPORTED');
    const chunks=[];let size=0;
    while(true){
      const chunk=Buffer.allocUnsafe(Math.min(65536,MAX_BYTES-size+1));
      const {bytesRead}=await handle.read(chunk,0,chunk.length,null);
      if(!bytesRead) break;
      size+=bytesRead;if(size>MAX_BYTES) fail('FILE_SIZE_UNSUPPORTED');chunks.push(chunk.subarray(0,bytesRead));
    }
    return {bytes:Buffer.concat(chunks,size),resolved};
  } finally { await handle.close(); }
}

function mimeFor(bytes,name){
  if(bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return 'image/jpeg';
  if(bytes.length>=12 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  return MIME_TYPES[path.extname(name).toLowerCase()]??fail('FILE_TYPE_UNSUPPORTED');
}

export async function inspectFile(file,{root=process.cwd()}={}){
  const {bytes,resolved}=await readLocal(file,root);const fileName=path.basename(resolved);
  const mimeType=mimeFor(bytes,fileName);
  return {fileName,mimeType,byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    ...(mimeType==='image/png' && bytes.length>=24 ? {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)} : {})};
}

function validateTransfer(value){
  if(!value || typeof value!=='object' || Array.isArray(value) || typeof value.ticket!=='string' || !/^v1\.[A-Za-z0-9_.-]+$/.test(value.ticket) || value.ticket.length>4096)fail('TRANSFER_INVALID');
  if(value.endpoint!==undefined && value.endpoint!==ENDPOINT)fail('TRANSFER_ORIGIN_NOT_ALLOWED');
  if(!Number.isSafeInteger(value.byteLength)||value.byteLength<1||value.byteLength>MAX_BYTES||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))fail('TRANSFER_METADATA_INVALID');
  if(typeof value.mimeType!=='string'||!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(value.mimeType))fail('TRANSFER_METADATA_INVALID');
  const expiry=Date.parse(value.expiresAt);if(!Number.isFinite(expiry)||expiry<=Date.now())fail('TRANSFER_EXPIRED');
  return value;
}

async function transferRequest(spec,method,body,fetchImpl){
  let response;
  try {
    response=await fetchImpl(ENDPOINT,{
      method,redirect:'error',signal:AbortSignal.timeout(120000),
      headers:{'x-formatry-transfer-ticket':spec.ticket,'x-request-id':randomUUID(),...(body?{'content-type':spec.mimeType}:{})},
      ...(body?{body:new Blob([new Uint8Array(body)])}:{}),
    });
  }catch{fail('TRANSFER_NETWORK_FAILED');}
  if(!response.ok){
    const data=await response.json().catch(()=>null);
    const code=data?.error?.code??data?.error;
    fail(typeof code==='string' && /^[A-Z_]{1,64}$/.test(code)?code:`TRANSFER_HTTP_${response.status}`);
  }
  return response;
}

export async function uploadFile(file,transfer,{root=process.cwd(),fetchImpl=fetch}={}){
  const spec=validateTransfer(transfer);const {bytes}=await readLocal(file,root);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  if(bytes.length!==spec.byteLength||sha256!==spec.sha256)fail('FILE_CHANGED_SINCE_PREPARATION');
  const response=await transferRequest(spec,'PUT',bytes,fetchImpl);
  if(response.status!==204)fail('UPLOAD_NOT_CONFIRMED');
  return {status:'uploaded',byteLength:bytes.length,sha256,nextAction:'Complete this upload through the Formatry MCP tool using its original uploadId and assetId.'};
}

async function destinationPath(output,root){
  root=await fs.realpath(root);const target=path.resolve(root,output);
  if(!inside(root,target)||target===root)fail('OUTPUT_OUTSIDE_WORKSPACE');
  const parent=path.dirname(target);
  const rel=path.relative(root,parent);let current=root;
  for(const segment of rel.split(path.sep).filter(Boolean)){
    current=path.join(current,segment);
    try {const info=await fs.lstat(current);if(info.isSymbolicLink()||!info.isDirectory())fail('OUTPUT_PARENT_UNSAFE');}
    catch(error){if(error.code!=='ENOENT')throw error;await fs.mkdir(current,{mode:0o700});}
  }
  const resolvedParent=await fs.realpath(parent);if(!inside(root,resolvedParent))fail('OUTPUT_OUTSIDE_WORKSPACE');
  try {await fs.lstat(target);fail('OUTPUT_ALREADY_EXISTS');}catch(error){if(error.code!=='ENOENT')throw error;}
  return target;
}

export async function downloadFile(output,transfer,{root=process.cwd(),fetchImpl=fetch}={}){
  const spec=validateTransfer(transfer);const target=await destinationPath(output,root);
  const temp=await fs.mkdtemp(path.join(path.dirname(target),'.formatry-'));
  let handle;
  try {
    const file=path.join(temp,'payload');handle=await fs.open(file,'wx',0o600);
    const response=await transferRequest(spec,'GET',null,fetchImpl);
    const declared=response.headers.get('content-length');
    if(declared!==null && Number(declared)!==spec.byteLength)fail('DOWNLOAD_LENGTH_MISMATCH');
    if((response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase()!==spec.mimeType.toLowerCase())fail('DOWNLOAD_TYPE_MISMATCH');
    if(!response.body)fail('DOWNLOAD_BODY_MISSING');
    const hash=createHash('sha256');let byteLength=0;
    for await(const chunk of response.body){
      byteLength+=chunk.byteLength;if(byteLength>spec.byteLength||byteLength>MAX_BYTES)fail('DOWNLOAD_LENGTH_MISMATCH');
      hash.update(chunk);let offset=0;
      while(offset<chunk.byteLength){const written=await handle.write(chunk,offset,chunk.byteLength-offset);if(!written.bytesWritten)fail('DOWNLOAD_WRITE_FAILED');offset+=written.bytesWritten;}
    }
    const sha256=hash.digest('hex');if(byteLength!==spec.byteLength)fail('DOWNLOAD_LENGTH_MISMATCH');if(sha256!==spec.sha256)fail('DOWNLOAD_HASH_MISMATCH');
    await handle.sync();await handle.close();handle=null;
    // link fails atomically if another file appeared; never replace user data.
    await fs.link(file,target);
    return {status:'saved',path:target,mimeType:spec.mimeType,byteLength,sha256};
  } finally {
    if(handle)await handle.close();await fs.rm(temp,{recursive:true,force:true});
  }
}

async function readStdin(){let size=0;const chunks=[];for await(const chunk of process.stdin){size+=chunk.length;if(size>MAX_STDIN_BYTES)fail('TRANSFER_INPUT_TOO_LARGE');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {
    const [command,file,...extra]=process.argv.slice(2);if(!file||extra.length)fail('USAGE_INSPECT_UPLOAD_DOWNLOAD_FILE');
    const result=command==='inspect'?await inspectFile(file):command==='upload'?await uploadFile(file,await readStdin()):command==='download'?await downloadFile(file,await readStdin()):fail('UNKNOWN_COMMAND');
    process.stdout.write(JSON.stringify(result)+'\n');
  } catch(error){
    // Never log input tickets, response bodies, credentials or request headers.
    const code=typeof error.message==='string'&&/^[A-Z_0-9]{1,80}$/.test(error.message)?error.message:'FILE_TRANSFER_FAILED';
    process.stderr.write(JSON.stringify({status:'error',code})+'\n');process.exitCode=1;
  }
}
