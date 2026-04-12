export interface RequestContext {
  userId: string;
  schoolId: string;
  roles: string[];
}

export function buildRequestContext(
  partial?: Partial<RequestContext>,
): RequestContext {
  return {
    userId: partial?.userId ?? '',
    schoolId: partial?.schoolId ?? '',
    roles: partial?.roles ?? [],
  };
}
