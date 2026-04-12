import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  validate(payload: JwtPayload): CurrentUser {
    return {
      id: payload.sub,
      sessionId: payload.sid,
      schoolId: payload.schoolId,
      departmentId: payload.departmentId,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      roles: [payload.role],
    };
  }
}
