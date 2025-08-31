// 🚀 AFTER: Same React form with DHI - just changed the import!
import React, { useState } from 'react';
import { z } from 'dhi';  // ← Only change: 'zod' → 'dhi'

// Form schema (identical code)
const ContactFormSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number'),
  company: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  newsletter: z.boolean(),
  terms: z.boolean().refine(val => val === true, 'You must accept the terms'),
  category: z.enum(['support', 'sales', 'general', 'technical']),
  priority: z.enum(['low', 'medium', 'high']).default('medium')
});

type ContactForm = z.infer<typeof ContactFormSchema>;

const ContactFormComponent: React.FC = () => {
  const [formData, setFormData] = useState<Partial<ContactForm>>({
    newsletter: false,
    terms: false,
    category: 'general',
    priority: 'medium'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (name: keyof ContactForm, value: any) => {
    try {
      // Validate individual field (identical code, now faster with DHI!)
      const fieldSchema = ContactFormSchema.shape[name];
      fieldSchema.parse(value);
      setErrors(prev => ({ ...prev, [name]: '' }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [name]: error.issues[0].message }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Form validation now 1.8x faster with DHI!
      const validData = ContactFormSchema.parse(formData);
      console.log('Form submitted successfully:', validData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert('Form submitted successfully!');
      setFormData({
        newsletter: false,
        terms: false,
        category: 'general',
        priority: 'medium'
      });
      setErrors({});
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach(issue => {
          const path = issue.path.join('.');
          fieldErrors[path] = issue.message;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (name: keyof ContactForm, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Real-time validation now faster with DHI!
    validateField(name, value);
  };

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <div className="form-group">
        <label>First Name *</label>
        <input
          type="text"
          value={formData.firstName || ''}
          onChange={(e) => handleChange('firstName', e.target.value)}
          className={errors.firstName ? 'error' : ''}
        />
        {errors.firstName && <span className="error-message">{errors.firstName}</span>}
      </div>

      <div className="form-group">
        <label>Last Name *</label>
        <input
          type="text"
          value={formData.lastName || ''}
          onChange={(e) => handleChange('lastName', e.target.value)}
          className={errors.lastName ? 'error' : ''}
        />
        {errors.lastName && <span className="error-message">{errors.lastName}</span>}
      </div>

      <div className="form-group">
        <label>Email *</label>
        <input
          type="email"
          value={formData.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
          className={errors.email ? 'error' : ''}
        />
        {errors.email && <span className="error-message">{errors.email}</span>}
      </div>

      <div className="form-group">
        <label>Phone *</label>
        <input
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => handleChange('phone', e.target.value)}
          className={errors.phone ? 'error' : ''}
        />
        {errors.phone && <span className="error-message">{errors.phone}</span>}
      </div>

      <div className="form-group">
        <label>Company</label>
        <input
          type="text"
          value={formData.company || ''}
          onChange={(e) => handleChange('company', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Message *</label>
        <textarea
          value={formData.message || ''}
          onChange={(e) => handleChange('message', e.target.value)}
          className={errors.message ? 'error' : ''}
          rows={4}
        />
        {errors.message && <span className="error-message">{errors.message}</span>}
      </div>

      <div className="form-group">
        <label>Category *</label>
        <select
          value={formData.category || 'general'}
          onChange={(e) => handleChange('category', e.target.value)}
        >
          <option value="general">General</option>
          <option value="support">Support</option>
          <option value="sales">Sales</option>
          <option value="technical">Technical</option>
        </select>
      </div>

      <div className="form-group">
        <label>Priority</label>
        <select
          value={formData.priority || 'medium'}
          onChange={(e) => handleChange('priority', e.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="form-group checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.newsletter || false}
            onChange={(e) => handleChange('newsletter', e.target.checked)}
          />
          Subscribe to newsletter
        </label>
      </div>

      <div className="form-group checkbox">
        <label>
          <input
            type="checkbox"
            checked={formData.terms || false}
            onChange={(e) => handleChange('terms', e.target.checked)}
            className={errors.terms ? 'error' : ''}
          />
          I accept the terms and conditions *
        </label>
        {errors.terms && <span className="error-message">{errors.terms}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
};

export default ContactFormComponent;

// 📊 Performance Improvement: 1.8x faster form validation
// 🎯 Zero code changes required beyond import statement!
// ⚡ Users experience faster real-time validation feedback!
