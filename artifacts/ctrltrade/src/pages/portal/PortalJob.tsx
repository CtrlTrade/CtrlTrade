import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPortalJob,
  useSubmitPortalReview,
  getGetPortalJobQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PortalThread } from "./PortalThread";

export function PortalJob() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, error } = useGetPortalJob(id);
  useEffect(() => {
    const e = error as { status?: number } | null;
    if (isError && e?.status === 401) setLocation(`/portal/${tenantSlug}`);
  }, [isError, error, setLocation, tenantSlug]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const review = useSubmitPortalReview({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetPortalJobQueryKey(id) });
        toast({ title: "Thank you for your review" });
      },
      onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (!data) return <p>Job not found.</p>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Link
        href={`/portal/${tenantSlug}/app`}
        className="text-sm flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{data.number}</h1>
          <p className="text-muted-foreground">{data.title}</p>
          {data.engineerName ? (
            <p className="text-sm">
              Engineer: <span className="font-medium">{data.engineerName}</span>
            </p>
          ) : null}
        </div>
        <Badge className="uppercase rounded-xl">{data.status.replace("_", " ")}</Badge>
      </div>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="">Details</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {data.description ? <p>{data.description}</p> : null}
          {(data.addressLine1 || data.city) ? (
            <p className="text-muted-foreground">
              {[data.addressLine1, data.city, data.postcode].filter(Boolean).join(", ")}
            </p>
          ) : null}
          {data.scheduledStart ? (
            <p>
              Scheduled:{" "}
              <span className="font-mono">
                {new Date(data.scheduledStart).toLocaleString("en-GB")}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="">Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {data.timeline.map((t, idx) => (
              <li key={idx} className="flex items-start gap-3 border-l-2 border-border pl-3">
                <span className="text-xs text-muted-foreground font-mono w-32 shrink-0">
                  {new Date(t.at).toLocaleString("en-GB")}
                </span>
                <span>{t.label}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {data.status === "completed" ? (
        <Card className=" border-border shadow-sm">
          <CardHeader>
            <CardTitle className="">Leave a review</CardTitle>
          </CardHeader>
          <CardContent>
            {data.review ? (
              <div className="space-y-2 text-sm">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${i < data.review!.rating ? "fill-primary text-primary" : "text-muted"}`}
                    />
                  ))}
                </div>
                {data.review.comment ? <p>{data.review.comment}</p> : null}
                <p className="text-xs text-muted-foreground">
                  Submitted {new Date(data.review.createdAt).toLocaleString("en-GB")}
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!rating) return;
                  review.mutate({ jobId: id, data: { rating, comment: comment || undefined } });
                }}
                className="space-y-3"
              >
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const v = i + 1;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRating(v)}
                        data-testid={`button-portal-rating-${v}`}
                      >
                        <Star
                          className={`h-7 w-7 ${v <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                        />
                      </button>
                    );
                  })}
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us how it went (optional)"
                  className="rounded-xl"
                  data-testid="textarea-portal-review"
                />
                <Button
                  type="submit"
                  disabled={!rating || review.isPending}
                  className="rounded-xl font-bold"
                  data-testid="button-portal-submit-review"
                >
                  {review.isPending ? "Submitting…" : "Submit review"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className=" border-border shadow-sm">
        <CardHeader>
          <CardTitle className="">Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalThread subjectKind="job" subjectId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
