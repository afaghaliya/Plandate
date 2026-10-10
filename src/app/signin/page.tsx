import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Feedback";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;

  async function doSignIn(formData: FormData) {
    "use server";
    const from = String(formData.get("from") || "/");
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: from,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect(`/signin?error=1&from=${encodeURIComponent(from)}`);
      }
      throw error;
    }
  }

  return (
    <div className="container-page max-w-sm py-14">
      <h1 className="text-2xl font-extrabold text-center">Welcome back</h1>
      <p className="text-center text-[13px] text-ink-faint mt-1.5">
        Sign in to plan, join and chat.
      </p>

      <Card className="mt-6">
        <CardBody className="space-y-4">
          {params.error && <Notice tone="danger">That email or password isn&apos;t right.</Notice>}

          <form action={doSignIn} className="space-y-4">
            <input type="hidden" name="from" value={params.from ?? "/"} />
            <Field label="Email">
              <Input type="email" name="email" required autoComplete="email" placeholder="you@email.com" />
            </Field>
            <Field label="Password">
              <Input type="password" name="password" required autoComplete="current-password" placeholder="••••••••" />
            </Field>
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>

          <p className="text-[12.5px] text-ink-faint text-center">
            Demo account: <code className="font-mono">meera@planadate.demo</code> /{" "}
            <code className="font-mono">planadate123</code>
          </p>
        </CardBody>
      </Card>

      <p className="text-center text-[13px] text-ink-faint mt-5">
        New to Planadate?{" "}
        <Link href="/signup" className="font-bold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
