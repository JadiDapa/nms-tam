import { User } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function UserCard({ user }: { user: User }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate font-medium">
            {user.name || "—"}
          </p>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
          <Badge variant="outline" className="mt-2 text-xs capitalize">
            {user.role.toLowerCase()}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
