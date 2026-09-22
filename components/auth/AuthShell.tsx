import { ReactNode } from "react";
import { BrandMark } from "@/components/dashboard/BrandMark";

type Props = {
  title: string;
  description: string;
  children?: ReactNode;
  footer?: ReactNode;
};

// One frame for every signed-out page: brand pill, then a single rounded card on the page background.
export default function AuthShell({ title, description, children, footer }: Props) {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <BrandMark className="bg-card flex h-14 items-center gap-2.5 rounded-full py-2 pr-5 pl-2 shadow-xs" />

      <div className="bg-card w-full max-w-md space-y-6 rounded-3xl p-8 shadow-sm">
        <div className="space-y-1.5 text-center">
          <h1 className="text-foreground text-2xl font-medium tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {children}
      </div>

      {footer && <div className="text-muted-foreground max-w-md text-center text-xs">{footer}</div>}
    </main>
  );
}
