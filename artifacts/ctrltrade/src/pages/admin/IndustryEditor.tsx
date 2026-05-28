import { useState } from "react";
import { useAdminListIndustries, useAdminAddIndustryJobType, useAdminRemoveIndustryJobType, useAdminAddIndustryChecklist, useAdminRemoveIndustryChecklist, useAdminAddIndustryDocumentTemplate, useAdminRemoveIndustryDocumentTemplate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";

export function AdminIndustryEditor() {
  const { data: industries, isLoading, refetch } = useAdminListIndustries();
  const { toast } = useToast();
  const [expandedIndustry, setExpandedIndustry] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"job-types" | "checklists" | "doc-templates">("job-types");

  const addJobType = useAdminAddIndustryJobType();
  const removeJobType = useAdminRemoveIndustryJobType();
  const addChecklist = useAdminAddIndustryChecklist();
  const removeChecklist = useAdminRemoveIndustryChecklist();
  const addDocTemplate = useAdminAddIndustryDocumentTemplate();
  const removeDocTemplate = useAdminRemoveIndustryDocumentTemplate();

  const [jobTypeForm, setJobTypeForm] = useState({ name: "", description: "", durationHours: "" });
  const [checklistForm, setChecklistForm] = useState({ name: "", description: "", items: "" });
  const [docTemplateForm, setDocTemplateForm] = useState({ name: "", description: "", documentType: "", required: false });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const handleAddJobType = async (industryId: string) => {
    if (!jobTypeForm.name.trim()) return;
    try {
      await addJobType.mutateAsync({
        id: industryId,
        data: {
          name: jobTypeForm.name,
          description: jobTypeForm.description || undefined,
          durationHours: jobTypeForm.durationHours ? parseInt(jobTypeForm.durationHours) : undefined,
        } as any,
      });
      setJobTypeForm({ name: "", description: "", durationHours: "" });
      refetch();
      toast({ title: "Job type added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveJobType = async (industryId: string, itemId: string) => {
    try {
      await removeJobType.mutateAsync({ id: industryId, itemId });
      refetch();
      toast({ title: "Job type removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddChecklist = async (industryId: string) => {
    if (!checklistForm.name.trim()) return;
    const items = checklistForm.items.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
    try {
      await addChecklist.mutateAsync({
        id: industryId,
        data: {
          name: checklistForm.name,
          description: checklistForm.description || undefined,
          items,
        } as any,
      });
      setChecklistForm({ name: "", description: "", items: "" });
      refetch();
      toast({ title: "Checklist added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveChecklist = async (industryId: string, itemId: string) => {
    try {
      await removeChecklist.mutateAsync({ id: industryId, itemId });
      refetch();
      toast({ title: "Checklist removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddDocTemplate = async (industryId: string) => {
    if (!docTemplateForm.name.trim() || !docTemplateForm.documentType.trim()) return;
    try {
      await addDocTemplate.mutateAsync({
        id: industryId,
        data: {
          name: docTemplateForm.name,
          description: docTemplateForm.description || undefined,
          documentType: docTemplateForm.documentType,
          required: docTemplateForm.required,
        } as any,
      });
      setDocTemplateForm({ name: "", description: "", documentType: "", required: false });
      refetch();
      toast({ title: "Document template added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveDocTemplate = async (industryId: string, itemId: string) => {
    try {
      await removeDocTemplate.mutateAsync({ id: industryId, itemId });
      refetch();
      toast({ title: "Document template removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tighter">Industry Template Editor</h1>
        <p className="text-muted-foreground mt-1">Manage industry-specific content templates for tenant provisioning.</p>
      </div>

      <div className="space-y-4">
        {(industries ?? []).map((industry: any) => {
          const isExpanded = expandedIndustry === industry.id;
          return (
            <Card key={industry.id} className="border-border">
              <CardHeader className="cursor-pointer py-4" onClick={() => setExpandedIndustry(isExpanded ? null : industry.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="uppercase tracking-tight text-base">{industry.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {industry.jobTypes?.length ?? 0} job types · {industry.checklists?.length ?? 0} checklists · {industry.documentTemplates?.length ?? 0} doc templates
                    </CardDescription>
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="border-t border-border pt-4">
                  <div className="flex gap-2 mb-6">
                    {(["job-types", "checklists", "doc-templates"] as const).map((s) => (
                      <Button
                        key={s}
                        variant={activeSection === s ? "default" : "outline"}
                        size="sm"
                        className="rounded-none uppercase text-xs tracking-wider font-bold"
                        onClick={() => setActiveSection(s)}
                      >
                        {s === "job-types" ? "Job Types" : s === "checklists" ? "Checklists" : "Doc Templates"}
                      </Button>
                    ))}
                  </div>

                  {activeSection === "job-types" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {(industry.jobTypes ?? []).map((jt: any) => (
                          <div key={jt.id} className="flex items-center justify-between border border-border p-3">
                            <div>
                              <div className="font-bold text-sm uppercase">{jt.name}</div>
                              {jt.description && <div className="text-xs text-muted-foreground">{jt.description}</div>}
                              {jt.durationHours && <div className="text-xs text-muted-foreground">{jt.durationHours}h</div>}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveJobType(industry.id, jt.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="border border-dashed border-border p-4 space-y-3">
                        <Label className="uppercase text-xs tracking-wider">Add Job Type</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <Input placeholder="Name *" value={jobTypeForm.name} onChange={(e) => setJobTypeForm({ ...jobTypeForm, name: e.target.value })} className="rounded-none col-span-2" />
                          <Input placeholder="Hours" type="number" value={jobTypeForm.durationHours} onChange={(e) => setJobTypeForm({ ...jobTypeForm, durationHours: e.target.value })} className="rounded-none" />
                        </div>
                        <Input placeholder="Description" value={jobTypeForm.description} onChange={(e) => setJobTypeForm({ ...jobTypeForm, description: e.target.value })} className="rounded-none" />
                        <Button size="sm" className="rounded-none uppercase text-xs tracking-wider font-bold" onClick={() => handleAddJobType(industry.id)} disabled={addJobType.isPending || !jobTypeForm.name.trim()}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeSection === "checklists" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {(industry.checklists ?? []).map((cl: any) => (
                          <div key={cl.id} className="flex items-start justify-between border border-border p-3">
                            <div>
                              <div className="font-bold text-sm uppercase">{cl.name}</div>
                              {cl.description && <div className="text-xs text-muted-foreground">{cl.description}</div>}
                              {(cl.items ?? []).length > 0 && (
                                <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                                  {(cl.items as string[]).slice(0, 3).map((item: string, i: number) => <li key={i}>{item}</li>)}
                                  {(cl.items as string[]).length > 3 && <li>+{(cl.items as string[]).length - 3} more</li>}
                                </ul>
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => handleRemoveChecklist(industry.id, cl.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="border border-dashed border-border p-4 space-y-3">
                        <Label className="uppercase text-xs tracking-wider">Add Checklist</Label>
                        <Input placeholder="Name *" value={checklistForm.name} onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })} className="rounded-none" />
                        <Input placeholder="Description" value={checklistForm.description} onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })} className="rounded-none" />
                        <textarea
                          placeholder={"Items (one per line) *"}
                          value={checklistForm.items}
                          onChange={(e) => setChecklistForm({ ...checklistForm, items: e.target.value })}
                          className="w-full border border-input bg-background px-3 py-2 text-sm rounded-none resize-none h-24"
                        />
                        <Button size="sm" className="rounded-none uppercase text-xs tracking-wider font-bold" onClick={() => handleAddChecklist(industry.id)} disabled={addChecklist.isPending || !checklistForm.name.trim()}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeSection === "doc-templates" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {(industry.documentTemplates ?? []).map((dt: any) => (
                          <div key={dt.id} className="flex items-center justify-between border border-border p-3">
                            <div>
                              <div className="font-bold text-sm uppercase">{dt.name}</div>
                              {dt.description && <div className="text-xs text-muted-foreground">{dt.description}</div>}
                              <div className="text-xs font-mono mt-0.5">{dt.documentType}{dt.required ? " · required" : ""}</div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveDocTemplate(industry.id, dt.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="border border-dashed border-border p-4 space-y-3">
                        <Label className="uppercase text-xs tracking-wider">Add Document Template</Label>
                        <Input placeholder="Name *" value={docTemplateForm.name} onChange={(e) => setDocTemplateForm({ ...docTemplateForm, name: e.target.value })} className="rounded-none" />
                        <Input placeholder="Document Type * (e.g. risk_assessment)" value={docTemplateForm.documentType} onChange={(e) => setDocTemplateForm({ ...docTemplateForm, documentType: e.target.value })} className="rounded-none" />
                        <Input placeholder="Description" value={docTemplateForm.description} onChange={(e) => setDocTemplateForm({ ...docTemplateForm, description: e.target.value })} className="rounded-none" />
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id="doc-required" checked={docTemplateForm.required} onChange={(e) => setDocTemplateForm({ ...docTemplateForm, required: e.target.checked })} />
                          <label htmlFor="doc-required" className="text-sm font-bold uppercase">Required document</label>
                        </div>
                        <Button size="sm" className="rounded-none uppercase text-xs tracking-wider font-bold" onClick={() => handleAddDocTemplate(industry.id)} disabled={addDocTemplate.isPending || !docTemplateForm.name.trim() || !docTemplateForm.documentType.trim()}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
