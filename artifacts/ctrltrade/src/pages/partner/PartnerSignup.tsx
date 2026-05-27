import { useState } from "react";
import { Link, useLocation } from "wouter";
import { usePartnerSignup } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function PartnerSignup() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "" });
  const { toast } = useToast();
  const signup = usePartnerSignup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Application received", description: "Your application is pending review. You can sign in to track your status." });
        setLocation("/");
      },
      onError: (err: any) => toast({ title: "Signup failed", description: err.message ?? "Please check your details", variant: "destructive" }),
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-none border-border">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">Become a Partner</CardTitle>
          <CardDescription>Earn recurring commission for every trades business you refer to CtrlTrade®.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); signup.mutate({ data: form }); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Your Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-none" data-testid="input-partner-name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-none" data-testid="input-partner-signup-email" />
            </div>
            <div className="space-y-2">
              <Label>Company (optional)</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="rounded-none" data-testid="input-partner-company" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-none" data-testid="input-partner-signup-password" />
            </div>
            <Button type="submit" disabled={signup.isPending} className="w-full rounded-none uppercase tracking-wider font-bold" data-testid="button-partner-apply">
              {signup.isPending ? "Submitting…" : "Submit Application"}
            </Button>
            <div className="text-sm text-muted-foreground text-center pt-2">
              Already a partner?{" "}
              <Link href="/login" className="font-bold uppercase tracking-wider underline">Sign in</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
