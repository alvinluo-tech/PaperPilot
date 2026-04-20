"use server";

import { createClient } from "@/infrastructure/database/supabase/server";
import { redirect } from "next/navigation";

export async function loginAdminAction(prevState: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/factory");
}

export async function loginAction(prevState: { error: string | null }, formData: FormData): Promise<{ error: string | null }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function signUpAction(prevState: { error: string | null, success?: string | null }, formData: FormData): Promise<{ error: string | null, success?: string | null }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  // 1. Check if email is already registered using our secure endpoint equivalent logic
  // We can do this directly since we are on the server! No need to call our own API route.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  
  const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) return { error: "Failed to verify email availability." };

  const userExists = users.users.some(u => u.email?.toLowerCase() === email.toLowerCase());
  if (userExists) {
    return { error: "This email address is already registered. Please sign in instead." };
  }

  // 2. Proceed with custom signup flow
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email: email,
    password: password,
    options: {
      redirectTo: `${origin}/auth/callback`
    }
  });

  if (linkError) return { error: linkError.message || 'Failed to generate signup link' };

  const signupLink = linkData.properties?.action_link;
  if (!signupLink) return { error: 'Failed to get confirmation link' };

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY?.trim());

  const { error: emailError } = await resend.emails.send({
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
      </div>
    `
  });

  if (emailError) return { error: 'Failed to send confirmation email via Resend' };

  return { error: null, success: "Check your email for the confirmation link!" };
}

export async function updatePasswordAction(prevState: { error: string | null, success?: string | null }, formData: FormData): Promise<{ error: string | null, success?: string | null }> {
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null, success: "Password updated successfully! Redirecting..." };
}
export async function resetPasswordAction(prevState: { error: string | null, success?: string | null }, formData: FormData): Promise<{ error: string | null, success?: string | null }> {
  const email = formData.get("email") as string;
  if (!email) return { error: "Please enter your email address" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  
  const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) return { error: "Failed to verify email." };

  const userExists = users.users.some(u => u.email?.toLowerCase() === email.toLowerCase());
  if (!userExists) {
    return { error: "This email address is not registered in our system." };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: {
      redirectTo: `${origin}/auth/callback?next=/update-password`
    }
  });

  if (linkError) return { error: 'Failed to generate reset link' };

  const recoveryLink = linkData.properties?.action_link;
  if (!recoveryLink) return { error: 'Failed to get recovery link' };

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY?.trim());

  const { error: emailError } = await resend.emails.send({
    from: 'PaperPilot <noreply@mail.alvin-luo.me>',
    to: [email],
    subject: 'Reset your PaperPilot password',
    html: `
      <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; text-align: center;">PaperPilot Password Reset</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hello,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">Someone requested a password reset. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Reset Password</a>
        </div>
      </div>
    `
  });

  if (emailError) return { error: 'Failed to send email via Resend' };

  return { error: null, success: "Check your email for the password reset link!" };
}
