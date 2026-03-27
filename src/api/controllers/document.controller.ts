import type { Request, Response } from 'express';
import { catchAsync } from '../../utils/asyncHandler';
import { firstRouteParam } from '../../utils/routeParams';
import { streamDocumentPdf } from '../../services/document.service';

export const getDocumentPdf = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const documentId = firstRouteParam(req.params.documentId);
  await streamDocumentPdf(documentId, res, req.logger);
});
