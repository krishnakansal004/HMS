const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const checkFeatureMatch = (userFeatures, requiredFeature) => {
  if (!Array.isArray(userFeatures)) return false;
  
  const normRequired = normalize(requiredFeature);
  const isInvoiceReq = normRequired.includes('invoice') || normRequired.includes('billing') || normRequired.includes('billmanager') || normRequired.includes('bill');
  
  return userFeatures.some(f => {
    if (typeof f !== 'string') return false;
    const normF = normalize(f);
    
    // Direct match of normalized strings
    if (normF === normRequired) return true;
    
    // If it's invoice-related
    if (isInvoiceReq) {
      if (normF.includes('invoice') || normF.includes('billing') || normF.includes('billmanager') || normF.includes('bill')) {
        return true;
      }
    }
    
    // Check if the user feature is contained in or contains the required feature
    if (normF.includes(normRequired) || normRequired.includes(normF)) return true;
    
    // Strip prefixes like 'view_', 'manage_', 'create_', 'edit_', 'delete_'
    const prefixes = ['view', 'manage', 'create', 'edit', 'delete'];
    let cleanF = normF;
    let cleanReq = normRequired;
    for (const prefix of prefixes) {
      if (cleanF.startsWith(prefix)) cleanF = cleanF.slice(prefix.length);
      if (cleanReq.startsWith(prefix)) cleanReq = cleanReq.slice(prefix.length);
    }
    if (cleanF && cleanReq && (cleanF === cleanReq || cleanF.includes(cleanReq) || cleanReq.includes(cleanF))) return true;
    
    return false;
  });
};

// Middleware to allow admins OR users (subadmin) who have a specific feature
export function allowAdminOrFeature(feature) {
  return (req, res, next) => {
    try {
      const permDebug = process.env.PERM_DEBUG === 'true';
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const role = req.user.role || 'user';
      
      // Directors and Admins always pass simple feature checks
      if (role === 'admin' || role === 'director') return next();
      
      // Check user features array
      if (checkFeatureMatch(req.user.features, feature)) return next();
      
      // Check tenant-level plan features if available (e.g., req.tenant.plan.roleFeatures)
      if (req.tenant && req.tenant.plan && req.tenant.plan.roleFeatures) {
        const rf = req.tenant.plan.roleFeatures;
        // Subadmins get features from rf.subadmin
        if (rf.subadmin && checkFeatureMatch(rf.subadmin, feature)) return next();
      }
      
      // Log details to help debugging subadmin permission issues
      if (permDebug) {
        try {
          const debugInfo = {
            userId: req.user._id,
            userRole: req.user.role,
            userFeatures: req.user.features,
            tenantId: req.tenant && req.tenant._id,
            tenantRoleFeatures: req.tenant && req.tenant.plan && req.tenant.plan.roleFeatures
          };
          console.warn('[permissions] allowAdminOrFeature denied', feature, debugInfo);
        } catch (e) { /* ignore logging errors */ }
      }
      
      const resp = { error: 'Feature not allowed for your role' };
      if (permDebug) {
        resp.details = {
          requiredFeature: feature,
          userFeatures: req.user.features || null,
          tenantRoleFeatures: req.tenant && req.tenant.plan && req.tenant.plan.roleFeatures || null
        }
      }
      return res.status(403).json(resp);
    } catch (e) {
      console.error('[permissions] allowAdminOrFeature error', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}

export default allowAdminOrFeature;

// Allow listed roles, but if role is 'subadmin' require the specified feature (or tenant plan allows it)
export function allowRolesWithSubadminFeature(roles = [], feature) {
  return (req, res, next) => {
    try {
      const permDebug = process.env.PERM_DEBUG === 'true';
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const role = req.user.role || 'user';
      
      // 1. Direct role match (excluding subadmin which needs feature check)
      if (roles.includes(role) && role !== 'subadmin') return next();
  
      // 2. Director/Admin inheritance override
      if ((role === 'director' || role === 'admin') && (roles.includes('admin') || roles.includes('director'))) {
        return next();
      }
  
      // 3. Subadmin logic (requires the feature in user features or plan features)
      if (role === 'subadmin' && roles.includes('subadmin')) {
        const userFeatures = Array.isArray(req.user.features) ? req.user.features : [];
        
        // Match user features using our robust matcher
        if (checkFeatureMatch(userFeatures, feature)) return next();
        
        // Master feature overrides for Dashboard view/summaries
        const isDashboardRequest = feature.includes('summary') || feature === 'view_reports' || feature.includes('low-stock') || feature.includes('sales');
        if (isDashboardRequest) {
          const hasDashboardAccess = userFeatures.some(f => 
            typeof f === 'string' && (
              ['Dashboard', 'Inventory', 'Patients', 'Billing', 'Reports', 'Staff'].includes(f) ||
              f.toLowerCase().includes('dashboard') || 
              f.toLowerCase().includes('reports') ||
              f.toLowerCase().includes('management')
            )
          );
          if (hasDashboardAccess) {
            if (permDebug) console.log(`[permissions] Subadmin granted ${feature} via dashboard heuristic`);
            return next();
          }
        }
        
        if (req.tenant && req.tenant.plan && req.tenant.plan.roleFeatures) {
          const rf = req.tenant.plan.roleFeatures;
          if (rf.subadmin && checkFeatureMatch(rf.subadmin, feature)) return next();
        }
      }
  
      // Log details for debugging
      if (permDebug) {
        try {
          const debugInfo = {
            userId: req.user._id,
            userRole: req.user.role,
            userFeatures: req.user.features,
            tenantId: req.tenant && req.tenant._id,
            tenantRoleFeatures: req.tenant && req.tenant.plan && req.tenant.plan.roleFeatures
          };
          console.warn('[permissions] allowRolesWithSubadminFeature denied', { requiredFeature: feature, roles, debugInfo });
        } catch (e) { /* ignore logging errors */ }
      }
      
      const resp = { error: 'Forbidden' };
      if (permDebug) {
        resp.details = {
          requiredFeature: feature,
          allowedRoles: roles,
          userRole: role,
          userFeatures: req.user.features || null,
          tenantRoleFeatures: req.tenant && req.tenant.plan && req.tenant.plan.roleFeatures || null
        }
      }
      return res.status(403).json(resp);
    } catch (e) {
      console.error('[permissions] allowRolesWithSubadminFeature error', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
}
