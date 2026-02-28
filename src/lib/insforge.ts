import { createClient } from '@insforge/sdk';

const baseUrl = 'https://k7kddy9e.us-east.insforge.app';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzYwMTh9.6KYI5DXRXInr4J23_0srZOXY_YwtNdh4GjzJjJC48gk';

export const insforge = createClient({
  baseUrl,
  anonKey,
});
