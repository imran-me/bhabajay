import type { APIRoute, GetStaticPaths } from 'astro';
import { renderIconPng } from '../lib/og';

export const getStaticPaths: GetStaticPaths = () => [{ params: { size: '192' } }, { params: { size: '512' } }];

export const GET: APIRoute = ({ params }) =>
  new Response(new Uint8Array(renderIconPng(Number(params.size))), { headers: { 'Content-Type': 'image/png' } });
