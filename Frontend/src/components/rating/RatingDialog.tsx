import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { nowIST, formatIST } from '@/utils/timezone';
import { toast } from '@/hooks/use-toast';

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSave: (ratings: EmployeeRating) => void;
  currentRatings?: EmployeeRating;
}

export interface EmployeeRating {
  employeeId: string;
  productivityRating: number;
  productivityDescription: string;
  qualityRating: number;
  qualityDescription: string;
  month: string;
  year: number;
  ratedBy: string;
  ratedAt: string;
}

export default function RatingDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSave,
  currentRatings
}: RatingDialogProps) {
  const [productivityRating, setProductivityRating] = useState(currentRatings?.productivityRating || 0);
  const [productivityDescription, setProductivityDescription] = useState(currentRatings?.productivityDescription || '');
  const [qualityRating, setQualityRating] = useState(currentRatings?.qualityRating || 0);
  const [qualityDescription, setQualityDescription] = useState(currentRatings?.qualityDescription || '');
  const [hoveredProductivityStar, setHoveredProductivityStar] = useState(0);
  const [hoveredQualityStar, setHoveredQualityStar] = useState(0);

  useEffect(() => {
    if (open) {
      if (currentRatings) {
        setProductivityRating(currentRatings.productivityRating);
        setProductivityDescription(currentRatings.productivityDescription);
        setQualityRating(currentRatings.qualityRating);
        setQualityDescription(currentRatings.qualityDescription);
      } else {
        // Reset to default values for a new rating session
        setProductivityRating(0);
        setProductivityDescription('');
        setQualityRating(0);
        setQualityDescription('');
      }
    }
  }, [currentRatings, open, employeeId]);

  const handleSave = () => {
    if (productivityRating === 0 || qualityRating === 0) {
      toast({
        title: 'Error',
        description: 'Please provide ratings for both Productivity and Quality Score',
        variant: 'destructive'
      });
      return;
    }

    if (!productivityDescription.trim() || !qualityDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide descriptions for both ratings',
        variant: 'destructive'
      });
      return;
    }

    const now = nowIST();
    const rating: EmployeeRating = {
      employeeId,
      productivityRating,
      productivityDescription: productivityDescription.trim(),
      qualityRating,
      qualityDescription: qualityDescription.trim(),
      month: formatIST(now, 'MMMM'),
      year: now.getFullYear(),
      ratedBy: 'Current User', // This should come from auth context
      ratedAt: now.toISOString()
    };

    onSave(rating);
    toast({
      title: 'Success',
      description: `Ratings saved for ${employeeName}`
    });
    onOpenChange(false);
  };

  const renderStars = (
    rating: number,
    setRating: (rating: number) => void,
    hoveredStar: number,
    setHoveredStar: (star: number) => void
  ) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 transition-colors ${star <= (hoveredStar || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
                }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const getRatingText = (rating: number) => {
    if (rating === 0) return 'Not rated';
    if (rating === 1) return 'Poor';
    if (rating === 2) return 'Below Average';
    if (rating === 3) return 'Average';
    if (rating === 4) return 'Good';
    return 'Excellent';
  };

  const getRatingPercentage = (rating: number) => {
    return (rating / 5) * 100;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rate Employee Performance</DialogTitle>
          <DialogDescription>
            Provide performance ratings for {employeeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Productivity Rating */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Productivity</Label>
            <div className="flex items-center gap-4">
              {renderStars(
                productivityRating,
                setProductivityRating,
                hoveredProductivityStar,
                setHoveredProductivityStar
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {getRatingText(productivityRating)} ({getRatingPercentage(productivityRating)}%)
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="productivity-desc" className="text-sm">
                Description / Comments
              </Label>
              <Textarea
                id="productivity-desc"
                placeholder="Describe the employee's productivity, work efficiency, time management, etc."
                value={productivityDescription}
                onChange={(e) => setProductivityDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {productivityDescription.length}/500
              </p>
            </div>
          </div>

          {/* Quality Score Rating */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Quality Score</Label>
            <div className="flex items-center gap-4">
              {renderStars(
                qualityRating,
                setQualityRating,
                hoveredQualityStar,
                setHoveredQualityStar
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {getRatingText(qualityRating)} ({getRatingPercentage(qualityRating)}%)
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quality-desc" className="text-sm">
                Description / Comments
              </Label>
              <Textarea
                id="quality-desc"
                placeholder="Describe the quality of work, attention to detail, accuracy, etc."
                value={qualityDescription}
                onChange={(e) => setQualityDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {qualityDescription.length}/500
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Ratings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
