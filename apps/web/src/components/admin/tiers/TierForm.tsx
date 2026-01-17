'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Calculator,
} from 'lucide-react';
import { useAdminTiersStore } from '@/stores/admin/admin-tiers.store';
import type { CreateTierRequest, UpdateTierRequest, AdminTierResponse } from '@/lib/api';

interface TierFormProps {
  mode: 'create' | 'edit';
  initialData?: AdminTierResponse;
  tierNumber?: number;
}

function getInitialFormData(initialData?: AdminTierResponse) {
  return {
    tier: initialData?.tier ?? 1,
    name: initialData?.name ?? '',
    emoji: initialData?.emoji ?? '',
    price: initialData?.price ?? 10,
    lifespanDays: initialData?.lifespanDays ?? 7,
    yieldPercent: initialData?.yieldPercent ?? 135,
    imageUrl: initialData?.imageUrl ?? '',
    isVisible: initialData?.isVisible ?? true,
    isPubliclyAvailable: initialData?.isPubliclyAvailable ?? false,
    sortOrder: initialData?.sortOrder ?? 0,
  };
}

// Note: Parent component should use key={initialData?.id} to reset form when data changes
export function TierForm({ mode, initialData, tierNumber }: TierFormProps) {
  const router = useRouter();
  const { createTier, updateTier, isLoading, error, clearError } = useAdminTiersStore();

  const [formData, setFormData] = useState(() => getInitialFormData(initialData));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Calculate derived values
  const totalYield = formData.price * (formData.yieldPercent / 100);
  const dailyYield = totalYield / formData.lifespanDays;
  const profit = totalYield - formData.price;
  const profitPercent = ((profit / formData.price) * 100).toFixed(1);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (mode === 'create' && formData.tier < 1) {
      errors.tier = 'Tier number must be at least 1';
    }

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.length > 50) {
      errors.name = 'Name must be 50 characters or less';
    }

    if (!formData.emoji.trim()) {
      errors.emoji = 'Emoji is required';
    }

    if (formData.price < 0.01) {
      errors.price = 'Price must be at least 0.01';
    }

    if (formData.lifespanDays < 1 || formData.lifespanDays > 365) {
      errors.lifespanDays = 'Lifespan must be between 1 and 365 days';
    }

    if (formData.yieldPercent < 100 || formData.yieldPercent > 1000) {
      errors.yieldPercent = 'Yield must be between 100% and 1000%';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      if (mode === 'create') {
        const data: CreateTierRequest = {
          tier: formData.tier,
          name: formData.name.trim(),
          emoji: formData.emoji.trim(),
          price: formData.price,
          lifespanDays: formData.lifespanDays,
          yieldPercent: formData.yieldPercent,
          imageUrl: formData.imageUrl.trim() || undefined,
          isVisible: formData.isVisible,
          isPubliclyAvailable: formData.isPubliclyAvailable,
          sortOrder: formData.sortOrder,
        };
        await createTier(data);
        router.push('/admin/tiers');
      } else if (tierNumber) {
        const data: UpdateTierRequest = {
          name: formData.name.trim(),
          emoji: formData.emoji.trim(),
          price: formData.price,
          lifespanDays: formData.lifespanDays,
          yieldPercent: formData.yieldPercent,
          imageUrl: formData.imageUrl.trim() || undefined,
          isVisible: formData.isVisible,
          isPubliclyAvailable: formData.isPubliclyAvailable,
          sortOrder: formData.sortOrder,
        };
        await updateTier(tierNumber, data);
        router.push('/admin/tiers');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save tier');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? parseFloat(value) || 0
          : value,
    }));

    // Clear field error on change
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="
            flex items-center gap-2 px-4 py-2
            text-slate-300 hover:text-white
            transition-colors
          "
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Error messages */}
      {(submitError || error) && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400">{submitError || error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tier Number */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tier Number
                </label>
                <input
                  type="number"
                  name="tier"
                  value={formData.tier}
                  onChange={handleChange}
                  disabled={mode === 'edit'}
                  min={1}
                  max={100}
                  className={`
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border text-white
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${formErrors.tier ? 'border-red-500' : 'border-slate-700'}
                  `}
                />
                {formErrors.tier && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.tier}</p>
                )}
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Sort Order
                </label>
                <input
                  type="number"
                  name="sortOrder"
                  value={formData.sortOrder}
                  onChange={handleChange}
                  min={0}
                  className="
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border border-slate-700 text-white
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                  "
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., RUSTY LEVER"
                  maxLength={50}
                  className={`
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border text-white
                    placeholder:text-slate-500
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    ${formErrors.name ? 'border-red-500' : 'border-slate-700'}
                  `}
                />
                {formErrors.name && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Emoji */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Emoji
                </label>
                <input
                  type="text"
                  name="emoji"
                  value={formData.emoji}
                  onChange={handleChange}
                  placeholder="e.g., coins"
                  maxLength={10}
                  className={`
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border text-white text-2xl
                    placeholder:text-slate-500 placeholder:text-base
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    ${formErrors.emoji ? 'border-red-500' : 'border-slate-700'}
                  `}
                />
                {formErrors.emoji && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.emoji}</p>
                )}
              </div>

              {/* Image URL */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Image URL (optional)
                </label>
                <input
                  type="text"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/image.png"
                  className="
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border border-slate-700 text-white
                    placeholder:text-slate-500
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                  "
                />
              </div>
            </div>
          </div>

          {/* Economics Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Economics</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Price ($FORTUNE)
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  min={0.01}
                  step={0.01}
                  className={`
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border text-white
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    ${formErrors.price ? 'border-red-500' : 'border-slate-700'}
                  `}
                />
                {formErrors.price && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.price}</p>
                )}
              </div>

              {/* Lifespan */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Lifespan (days)
                </label>
                <input
                  type="number"
                  name="lifespanDays"
                  value={formData.lifespanDays}
                  onChange={handleChange}
                  min={1}
                  max={365}
                  className={`
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border text-white
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    ${formErrors.lifespanDays ? 'border-red-500' : 'border-slate-700'}
                  `}
                />
                {formErrors.lifespanDays && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.lifespanDays}</p>
                )}
              </div>

              {/* Yield Percent */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Yield (%)
                </label>
                <input
                  type="number"
                  name="yieldPercent"
                  value={formData.yieldPercent}
                  onChange={handleChange}
                  min={100}
                  max={1000}
                  className={`
                    w-full px-4 py-2.5 rounded-lg
                    bg-slate-800 border text-white
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    ${formErrors.yieldPercent ? 'border-red-500' : 'border-slate-700'}
                  `}
                />
                {formErrors.yieldPercent && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.yieldPercent}</p>
                )}
              </div>
            </div>
          </div>

          {/* Visibility Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Visibility & Access</h3>

            <div className="space-y-4">
              {/* Is Visible */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isVisible"
                  checked={formData.isVisible}
                  onChange={handleChange}
                  className="
                    w-5 h-5 rounded
                    bg-slate-800 border border-slate-600
                    text-amber-500 focus:ring-amber-500/50
                    cursor-pointer
                  "
                />
                <div>
                  <span className="text-white font-medium">Visible in Shop</span>
                  <p className="text-sm text-slate-400">
                    When enabled, this tier will be shown in the shop
                  </p>
                </div>
              </label>

              {/* Is Publicly Available */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="isPubliclyAvailable"
                  checked={formData.isPubliclyAvailable}
                  onChange={handleChange}
                  className="
                    w-5 h-5 rounded
                    bg-slate-800 border border-slate-600
                    text-amber-500 focus:ring-amber-500/50
                    cursor-pointer
                  "
                />
                <div>
                  <span className="text-white font-medium">Publicly Available</span>
                  <p className="text-sm text-slate-400">
                    When enabled, users can buy this tier without progression requirement
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Preview sidebar */}
        <div className="space-y-6">
          {/* Preview Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>

            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{formData.emoji || '?'}</span>
                <div>
                  <p className="text-white font-medium">
                    {formData.name || 'Tier Name'}
                  </p>
                  <p className="text-sm text-slate-400">Tier #{formData.tier}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-700">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Price</span>
                  <span className="text-amber-400 font-medium">
                    ${formData.price.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Lifespan</span>
                  <span className="text-white">{formData.lifespanDays} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Yield</span>
                  <span className="text-green-400">{formData.yieldPercent}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Calculator Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-white">Calculator</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total payout</span>
                <span className="text-white font-medium">
                  ${totalYield.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Net profit</span>
                <span className="text-green-400 font-medium">
                  ${profit.toFixed(2)} ({profitPercent}%)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Daily yield</span>
                <span className="text-blue-400 font-medium">
                  ${dailyYield.toFixed(4)}/day
                </span>
              </div>
              <div className="pt-3 border-t border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-400">ROI per day</span>
                  <span className="text-purple-400 font-medium">
                    {((formData.yieldPercent - 100) / formData.lifespanDays).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="
              w-full flex items-center justify-center gap-2
              px-6 py-3 rounded-lg
              bg-amber-600 text-white font-medium
              hover:bg-amber-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>{mode === 'create' ? 'Create Tier' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
