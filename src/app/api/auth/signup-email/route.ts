import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY?.trim());

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Initialize Supabase admin client using Service Role Key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    // Generate a signup link directly via Supabase Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email,
      password: password,
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    });

    if (linkError) {
      console.error('Error generating signup link:', linkError);
      return NextResponse.json({ error: linkError.message || 'Failed to generate signup link' }, { status: 500 });
    }

    const signupLink = linkData.properties?.action_link;
    if (!signupLink) {
      return NextResponse.json({ error: 'Failed to get confirmation link' }, { status: 500 });
    }

    // Send the email using Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'PaperPilot <noreply@mail.alvin-luo.me>',
      to: [email],
      subject: 'Confirm your PaperPilot registration',
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; text-align: center;">Welcome to PaperPilot!</h2>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">Thank you for registering with PaperPilot. Please confirm your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Confirm Email</a>
          </div>
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">If you didn't request this registration, you can safely ignore this email.</p>
          <p style="color: #64748b; font-size: 14px;">Alternatively, you can copy and paste this link into your browser:<br/><a href="${signupLink}" style="color: #2563eb; word-break: break-all;">${signupLink}</a></p>
        </div>
      `
    });

    if (emailError) {
      console.error('Resend Error:', emailError);
      return NextResponse.json({ error: 'Failed to send confirmation email via Resend' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: emailData?.id });

  } catch (error) {
    console.error('Signup Email API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
