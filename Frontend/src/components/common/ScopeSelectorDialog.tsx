import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ScopeSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ScopeSelectorDialog: React.FC<ScopeSelectorDialogProps> = ({ open, onOpenChange }) => {
    const { user } = useAuth();
    const [branchId, setBranchId] = useState(localStorage.getItem('branchId') || '');
    const [companyId, setCompanyId] = useState(localStorage.getItem('companyId') || '');

    useEffect(() => {
        if (open) {
            setBranchId(localStorage.getItem('branchId') || '');
            setCompanyId(localStorage.getItem('companyId') || '');
        }
    }, [open]);

    const handleApply = () => {
        if (branchId) localStorage.setItem('branchId', branchId);
        if (companyId) localStorage.setItem('companyId', companyId);
        onOpenChange(false);
        window.location.reload();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md border-2 border-amber-200">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-700">
                        <AlertCircle className="h-5 w-5" />
                        Scope Selection Required
                    </DialogTitle>
                    <DialogDescription className="font-medium text-slate-600">
                        Your account is assigned to multiple organizations or branches.
                        Please specify a Branch ID or Company ID to continue.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-bold">Current User Role: {user?.role}</Label>
                        <p className="text-[11px] text-slate-500 italic">
                            Tip: You can find these IDs in your profile (under professional info) or ask your administrator.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="branch-id">Branch ID</Label>
                        <Input
                            id="branch-id"
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            placeholder="e.g. 1"
                            className="border-2 focus:border-blue-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="company-id">Company ID</Label>
                        <Input
                            id="company-id"
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value)}
                            placeholder="e.g. 1"
                            className="border-2 focus:border-blue-500"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border-slate-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApply}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                        Apply Scope & Refresh
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
