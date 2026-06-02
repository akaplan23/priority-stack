"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from '../../lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0e0e16",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        border: "1px solid #1e1e2a",
        borderRadius: "6px",
        background: "#13131c",
        padding: "32px",
      }}>
        <div style={{ marginBottom: "24px", textAlign: "center" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", color: "#5a5aff", letterSpacing: "0.1em" }}>PS</span>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#e8e8f0", marginLeft: "10px" }}>Priority Stack</span>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={[]}
        />
      </div>
    </div>
  )
}