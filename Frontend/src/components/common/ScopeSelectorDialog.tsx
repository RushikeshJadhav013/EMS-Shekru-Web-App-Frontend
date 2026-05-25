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

    return null;
};
