import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="hidden sm:inline-flex">
        Sign out
      </Button>
    </form>
  );
}
