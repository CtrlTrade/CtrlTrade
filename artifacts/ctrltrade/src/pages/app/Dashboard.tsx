import { useGetOnboarding, useGetSubscription, useUpdateSubscriptionQuantities, useCancelTenant } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { CheckCircle2, Circle, AlertTriangle, CreditCard, Users, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function AppDashboard() {
  const { data: onboarding, isLoading: isLoadingOnboarding } = useGetOnboarding();
  const { data: subscription, isLoading: isLoadingSub } = useGetSubscription();
  
  if (isLoadingOnboarding || isLoadingSub) {
    return <div className="space-y-6"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold uppercase tracking-tighter">Command Center</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {onboarding && (
            <Card className="rounded-none border-border shadow-sm">
              <CardHeader>
                <CardTitle className="uppercase tracking-tight">Onboarding Protocol</CardTitle>
                <CardDescription>Complete these steps to fully activate your tenant workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-sm font-bold font-mono">
                    <span>{onboarding.percentComplete}% Complete</span>
                  </div>
                  <Progress value={onboarding.percentComplete} className="h-2 rounded-none bg-muted [&>div]:bg-primary" />
                </div>
                
                <div className="space-y-4">
                  {onboarding.items.map((item) => (
                    <div key={item.key} className="flex items-start gap-4 p-4 border border-border bg-background">
                      {item.complete ? (
                        <CheckCircle2 className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h4 className={`font-bold ${item.complete ? 'line-through text-muted-foreground' : ''}`}>{item.label}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      </div>
                      {!item.complete && item.href && (
                        <Link href={item.href}>
                          <Button variant="outline" size="sm" className="rounded-none uppercase tracking-wider text-xs font-bold shrink-0">
                            Action
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div>
          {subscription && <SubscriptionCard subscription={subscription} />}
        </div>
      </div>
    </div>
  );
}

function SubscriptionCard({ subscription }: { subscription: any }) {
  const [showUpdate, setShowUpdate] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  
  return (
    <>
      <Card className="rounded-none border-border shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="uppercase tracking-tight">Subscription</CardTitle>
            <div className={`px-2 py-1 text-xs font-bold uppercase tracking-wider ${
              subscription.status === 'trial' ? 'bg-primary/20 text-primary' : 
              subscription.status === 'active' ? 'bg-green-500/20 text-green-500' : 
              'bg-destructive/20 text-destructive'
            }`}>
              {subscription.status}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription.status === 'trial' && subscription.trialEndsAt && (
            <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary p-3 border border-primary/20">
              <AlertTriangle className="h-4 w-4" />
              <span>Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</span>
            </div>
          )}
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4"/> Control Seats</span>
              <span className="font-bold font-mono">{subscription.controlSeats}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4"/> Field Seats</span>
              <span className="font-bold font-mono">{subscription.fieldSeats}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground"><ShoppingCart className="h-4 w-4"/> POS Tills</span>
              <span className="font-bold font-mono">{subscription.tills}</span>
            </div>
          </div>
          
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-sm tracking-wider">Monthly Total</span>
              <span className="text-xl font-bold font-mono text-primary">£{subscription.monthlyTotal}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button className="w-full rounded-none uppercase font-bold tracking-wider text-xs" onClick={() => setShowUpdate(true)}>
            Update Quantities
          </Button>
          <Button variant="ghost" className="w-full rounded-none uppercase font-bold tracking-wider text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowCancel(true)}>
            Cancel Subscription
          </Button>
        </CardFooter>
      </Card>
      
      {showUpdate && <UpdateQuantitiesDialog subscription={subscription} open={showUpdate} onOpenChange={setShowUpdate} />}
      {showCancel && <CancelSubscriptionDialog open={showCancel} onOpenChange={setShowCancel} />}
    </>
  );
}

function UpdateQuantitiesDialog({ subscription, open, onOpenChange }: { subscription: any, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [controlSeats, setControlSeats] = useState(subscription.controlSeats);
  const [fieldSeats, setFieldSeats] = useState(subscription.fieldSeats);
  const [tills, setTills] = useState(subscription.tills);
  const update = useUpdateSubscriptionQuantities();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({ data: { controlSeats, fieldSeats, tills } }, {
      onSuccess: () => {
        toast({ title: "Subscription updated", description: "Quantities have been updated successfully." });
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight">Update Quantities</DialogTitle>
          <DialogDescription>Adjust the number of seats and tills for your tenant.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="controlSeats" className="col-span-2">Control Seats</Label>
            <Input id="controlSeats" type="number" min="1" value={controlSeats} onChange={e => setControlSeats(parseInt(e.target.value))} className="col-span-2 rounded-none" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="fieldSeats" className="col-span-2">Field Seats</Label>
            <Input id="fieldSeats" type="number" min="0" value={fieldSeats} onChange={e => setFieldSeats(parseInt(e.target.value))} className="col-span-2 rounded-none" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tills" className="col-span-2">POS Tills</Label>
            <Input id="tills" type="number" min="0" value={tills} onChange={e => setTills(parseInt(e.target.value))} className="col-span-2 rounded-none" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending} className="rounded-none uppercase font-bold tracking-wider">
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelSubscriptionDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const cancel = useCancelTenant();
  const { toast } = useToast();
  const [reason, setReason] = useState("");

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    
    cancel.mutate({ data: { reason } }, {
      onSuccess: () => {
        toast({ title: "Subscription cancelled", description: "Your subscription has been cancelled." });
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ title: "Cancellation failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-destructive sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-tight text-destructive">Cancel Subscription</DialogTitle>
          <DialogDescription>This action will terminate your subscription at the end of the current billing period.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCancel} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for cancellation</Label>
            <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="Required" required className="rounded-none" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-none uppercase font-bold tracking-wider">
              Keep Subscription
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending} className="rounded-none uppercase font-bold tracking-wider">
              {cancel.isPending ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
