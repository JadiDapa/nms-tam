import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../StatusBadge";
import { formatDate, formatIDR } from "@/lib/format";

export type PaymentRow = {
  id: number;
  receiptNumber: string;
  orgName?: string;
  kind: string;
  amount: number;
  method: string;
  paidAt: Date;
  reference: string;
  coversUntil: Date | null;
  voidedAt: Date | null;
};

const KIND_LABEL: Record<string, string> = {
  ACTIVATION: "Activation",
  RENEWAL: "Renewal",
  EXTRA_SLOTS: "Extra slots",
  ADJUSTMENT: "Adjustment",
};

const headCell = "text-muted-foreground h-10 px-3 text-xs font-medium first:rounded-l-xl first:pl-4 last:rounded-r-xl last:pr-4";
const bodyCell = "px-3 py-3 first:pl-4 last:pr-4";

type Props = {
  payments: PaymentRow[];
  showClient?: boolean;
  // a heading inside the card (the client's billing page); the admin pages bring their own
  title?: string;
  description?: string;
};

// The payment history. Used by the client's billing page and by the admin pages.
export default function PaymentList({ payments, showClient, title, description }: Props) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">No payments recorded yet.</p>
        ) : (
          <Table>
            <TableHeader className="bg-muted [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className={headCell}>Receipt</TableHead>
                {showClient && <TableHead className={headCell}>Client</TableHead>}
                <TableHead className={headCell}>For</TableHead>
                <TableHead className={headCell}>Amount</TableHead>
                <TableHead className={headCell}>Paid</TableHead>
                <TableHead className={cn(headCell, "hidden lg:table-cell")}>Reference</TableHead>
                <TableHead className={cn(headCell, "hidden md:table-cell")}>Covers until</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id} className={cn("border-border/60", p.voidedAt && "opacity-60")}>
                  <TableCell className={bodyCell}>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/receipts/${p.id}`} className={cn("font-mono text-sm font-medium hover:underline", p.voidedAt && "line-through")}>
                        {p.receiptNumber}
                      </Link>
                      {p.voidedAt && <StatusBadge label="VOID" tone="red" className="rounded-[6px]" />}
                    </div>
                  </TableCell>
                  {showClient && <TableCell className={cn(bodyCell, "text-sm")}>{p.orgName}</TableCell>}
                  <TableCell className={bodyCell}>
                    <span className="bg-muted text-muted-foreground rounded-[6px] px-2 py-1 text-xs font-medium whitespace-nowrap">
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </span>
                  </TableCell>
                  <TableCell className={cn(bodyCell, "font-mono text-sm font-medium whitespace-nowrap tabular-nums")}>{formatIDR(p.amount)}</TableCell>
                  <TableCell className={bodyCell}>
                    <p className="text-sm whitespace-nowrap">{formatDate(p.paidAt)}</p>
                    <p className="text-muted-foreground text-xs capitalize">{p.method.replace("_", " ").toLowerCase()}</p>
                  </TableCell>
                  <TableCell className={cn(bodyCell, "text-muted-foreground hidden max-w-48 truncate text-sm lg:table-cell")}>{p.reference}</TableCell>
                  <TableCell className={cn(bodyCell, "hidden text-sm whitespace-nowrap md:table-cell")}>{formatDate(p.coversUntil)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
