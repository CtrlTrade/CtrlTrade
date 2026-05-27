import { useState, useEffect } from "react";
import { useGetBookingWidgetConfig, useUpdateBookingWidgetConfig } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function BookingWidgetSettings() {
  const { data, isLoading } = useGetBookingWidgetConfig();
  const updateConfig = useUpdateBookingWidgetConfig();
  const { toast } = useToast();

  const [active, setActive] = useState(false);
  const [showDateField, setShowDateField] = useState(true);
  const [thankYouMessage, setThankYouMessage] = useState("Thanks for your enquiry — we'll be in touch shortly.");
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [newJobType, setNewJobType] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setActive(data.active);
      setShowDateField(data.showDateField);
      setThankYouMessage(data.thankYouMessage);
      setJobTypes(data.jobTypes);
      setDirty(false);
    }
  }, [data]);

  const markDirty = () => setDirty(true);

  const addJobType = () => {
    const trimmed = newJobType.trim();
    if (!trimmed || jobTypes.includes(trimmed)) return;
    setJobTypes([...jobTypes, trimmed]);
    setNewJobType("");
    markDirty();
  };

  const removeJobType = (jt: string) => {
    setJobTypes(jobTypes.filter((j) => j !== jt));
    markDirty();
  };

  const handleSave = () => {
    updateConfig.mutate(
      { data: { active, showDateField, thankYouMessage, jobTypes } },
      {
        onSuccess: () => {
          toast({ title: "Booking widget saved" });
          setDirty(false);
        },
        onError: (err: any) => {
          toast({ title: "Save failed", description: err.message, variant: "destructive" });
        },
      },
    );
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied` }),
      () => toast({ title: "Copy failed", variant: "destructive" }),
    );
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="uppercase tracking-tight">Booking Widget</CardTitle>
              <CardDescription>
                Give customers a way to submit job enquiries directly from your website. Submissions create a lead in the CRM automatically.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {active ? "Active" : "Disabled"}
              </span>
              <Switch
                checked={active}
                onCheckedChange={(v) => { setActive(v); markDirty(); }}
                data-testid="switch-booking-active"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-sm">Booking Page URL</CardTitle>
          <CardDescription>Share this link with customers or use it as the iframe source.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={data.bookingPageUrl}
              readOnly
              className="rounded-none font-mono text-xs"
              data-testid="input-booking-page-url"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => copy(data.bookingPageUrl, "Booking page URL")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => window.open(data.bookingPageUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-sm">Form Configuration</CardTitle>
          <CardDescription>Customise what appears on the booking form.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-semibold">Show preferred date field</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Let customers suggest a preferred date for the job.</p>
            </div>
            <Switch
              checked={showDateField}
              onCheckedChange={(v) => { setShowDateField(v); markDirty(); }}
              data-testid="switch-show-date"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">Custom thank-you message</Label>
            <Textarea
              value={thankYouMessage}
              onChange={(e) => { setThankYouMessage(e.target.value); markDirty(); }}
              rows={2}
              maxLength={500}
              className="rounded-none text-sm"
              data-testid="textarea-thank-you"
              placeholder="We'll be in touch shortly."
            />
            <p className="text-xs text-muted-foreground">{thankYouMessage.length}/500 characters</p>
          </div>

          <div className="space-y-3">
            <Label className="font-semibold">Job types</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Add job type options for the dropdown on the form. Leave empty to hide the dropdown.
            </p>
            <div className="flex flex-wrap gap-2">
              {jobTypes.map((jt) => (
                <Badge key={jt} variant="secondary" className="rounded-none text-xs gap-1 pr-1">
                  {jt}
                  <button
                    type="button"
                    onClick={() => removeJobType(jt)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newJobType}
                onChange={(e) => setNewJobType(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addJobType(); }}}
                placeholder="e.g. Boiler repair"
                className="rounded-none text-sm max-w-xs"
                data-testid="input-new-job-type"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-none"
                onClick={addJobType}
                disabled={!newJobType.trim()}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateConfig.isPending || !dirty}
          className="rounded-none uppercase font-bold tracking-wider"
          data-testid="button-save-booking-widget"
        >
          {updateConfig.isPending ? "Saving…" : "Save Widget Settings"}
        </Button>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="uppercase tracking-tight text-sm">Embed on Your Website</CardTitle>
          <CardDescription>
            Copy one of these snippets and paste it into any page on your website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="font-semibold">iframe embed (simplest)</Label>
            <div className="relative">
              <Textarea
                value={data.iframeCode}
                readOnly
                rows={2}
                className="rounded-none font-mono text-xs pr-10"
                data-testid="textarea-iframe-code"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none uppercase text-xs font-bold"
              onClick={() => copy(data.iframeCode, "iframe code")}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy iframe
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">HTML + JS embed (native form)</Label>
            <p className="text-xs text-muted-foreground">
              Paste this into any page. The form submits via AJAX and shows the thank-you message inline.
            </p>
            <Textarea
              value={data.embedCode}
              readOnly
              rows={12}
              className="rounded-none font-mono text-xs"
              data-testid="textarea-embed-code"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-none uppercase text-xs font-bold"
              onClick={() => copy(data.embedCode, "Embed code")}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy embed
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
