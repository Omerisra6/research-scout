import { NextResponse } from 'next/server';
import { getProfile, updateProfile } from '@/lib/db';

export async function GET() {
  const profile = getProfile();
  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
  const data = await request.json();
  const profile = updateProfile(data);
  return NextResponse.json(profile);
}
