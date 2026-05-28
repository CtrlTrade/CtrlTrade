import { useState } from "react";
import {
  useListComplianceQueue,
  useApproveVerificationSubmission,
  useRejectVerificationSubmission,
  getListComplianceQueueQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, ShieldX, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Submission = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerEmail: string | null;
  rejectionReason: string | null;
  createdAt: string;
  documents: Array<{
    certificateId: string;
    kind: string;
    reference: string | null;
    documentUrl: string | null;
    expiresAt: string | null;
  }>;
};

function statusBadge(status: string) {
  if (status === "approved")
    return <Badge className="rounded-none uppercase bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive" className="rounded-none uppercase"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  return <Badge className="rounded-none uppercase bg-amber-500 text-white"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
}

export function AdminCompliance() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useListComplianceQueue({ status: statusFilter });

  const approve = useApproveVerificationSubmission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListComplianceQueueQueryKey() });
        toast({ title: "Badge awarded", description: "The tenant has been verified." });
        setSelected(null);
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const reject = useRejectVerificationSubmission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListComplianceQueueQueryKey() });
        toast({ title: "Application rejected" });
        setRejectDialogOpen(false);
        setSelected(null);
        setRejectReason("");
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const submissions = (data as Submission[] | undefined) ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AdminPageHeader
        title="Compliance Queue"
        icon={<ShieldCheck className="h-6 w-6" />}
        actions={
          <div className="flex gap-2 flex-wrap">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                className="uppercase tracking-wider font-bold text-xs rounded-none"
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        }
      />

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-sm">
            Verification Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : submissions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No submissions found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Docs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => (
                  <TableRow key={sub.id} data-testid={`row-submission-${sub.id}`}>
                    <TableCell>
                      <div className="font-medium">{sub.tenantName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{sub.tenantSlug}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => setSelected(sub)}
                        data-testid={`button-view-docs-${sub.id}`}
                      >
                        <FileText className="h-3 w-3" />
                        {sub.documents.length} doc{sub.documents.length !== 1 ? "s" : ""}
                      </Button>
                    </TableCell>
                    <TableCell>{statusBadge(sub.status)}</TableCell>
                    <TableCell>
                      {sub.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="rounded-none uppercase tracking-wider font-bold text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => approve.mutate({ submissionId: sub.id })}
                            disabled={approve.isPending}
                            data-testid={`button-approve-${sub.id}`}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="rounded-none uppercase tracking-wider font-bold text-xs"
                            onClick={() => {
                              setSelected(sub);
                              setRejectDialogOpen(true);
                            }}
                            data-testid={`button-reject-${sub.id}`}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      {sub.status === "rejected" && sub.rejectionReason && (
                        <span className="text-xs text-muted-foreground italic truncate max-w-[200px] block">
                          {sub.rejectionReason}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Dialog open={!!selected && !rejectDialogOpen} onOpenChange={(open) => { if (!open) setSelected(null); }}>
          <DialogContent className="rounded-none max-w-2xl">
            <DialogHeader>
              <DialogTitle className="uppercase tracking-tighter flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> {selected.tenantName} — Submitted Documents
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Status:</span>
                {statusBadge(selected.status)}
                {selected.reviewerEmail && (
                  <span className="text-muted-foreground text-xs">by {selected.reviewerEmail}</span>
                )}
              </div>
              {selected.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents submitted.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Document</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.documents.map((doc) => {
                      const expired =
                        doc.expiresAt && new Date(doc.expiresAt) < new Date();
                      return (
                        <TableRow key={doc.certificateId}>
                          <TableCell className="font-medium">{doc.kind}</TableCell>
                          <TableCell className="font-mono text-sm">{doc.reference ?? "—"}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {doc.expiresAt ? (
                              <span className={expired ? "text-destructive font-bold" : ""}>
                                {new Date(doc.expiresAt).toLocaleDateString()}
                                {expired ? " (EXPIRED)" : ""}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {doc.documentUrl ? (
                              <a
                                href={doc.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs underline uppercase tracking-wider font-bold"
                              >
                                View
                              </a>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
            {selected.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button
                  className="rounded-none uppercase tracking-wider font-bold bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => approve.mutate({ submissionId: selected.id })}
                  disabled={approve.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Approve & Award Badge
                </Button>
                <Button
                  variant="destructive"
                  className="rounded-none uppercase tracking-wider font-bold"
                  onClick={() => setRejectDialogOpen(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectReason(""); } }}>
        <DialogContent className="rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-tighter flex items-center gap-2">
              <ShieldX className="h-5 w-5" /> Reject Application
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Rejecting the application for <strong>{selected?.tenantName}</strong>. The tenant will be notified with the reason below.
            </p>
            <div>
              <Label>Reason for rejection</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Insurance certificate is expired. Please renew and reapply."
                rows={3}
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none uppercase tracking-wider font-bold text-xs"
              onClick={() => { setRejectDialogOpen(false); setRejectReason(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-none uppercase tracking-wider font-bold"
              disabled={!rejectReason.trim() || reject.isPending}
              onClick={() => {
                if (!selected) return;
                reject.mutate({ submissionId: selected.id, data: { reason: rejectReason.trim() } });
              }}
              data-testid="button-confirm-reject"
            >
              {reject.isPending ? "Rejecting…" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
