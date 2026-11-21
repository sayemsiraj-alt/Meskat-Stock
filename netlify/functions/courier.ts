export type CourierStatus =
  | 'Pending Booking'
  | 'Booked'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Returned'
  | 'Cancelled';

const mapSteadfastStatus = (raw: string): CourierStatus => {
  const s = (raw || '').toLowerCase();
  if (s.includes('delivered')) return 'Delivered';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('return') || s.includes('partial_delivered')) return 'Returned';
  if (s.includes('hold') || s.includes('pending')) return 'Pending Booking';
  if (s.includes('in_review') || s.includes('unknown')) return 'Booked';
  return 'In Transit';
};

const mapRedxStatus = (raw: string): CourierStatus => {
  const s = (raw || '').toLowerCase();
  if (s.includes('delivered')) return 'Delivered';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('return')) return 'Returned';
  if (s.includes('out-for-delivery') || s.includes('delivery-in-progress')) return 'Out for Delivery';
  if (s.includes('ready-for-delivery') || s.includes('pickup')) return 'Booked';
  return 'In Transit';
};

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ configured: false, message: 'Method not allowed. Use POST.' }),
    };
  }

  let payload: any = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ configured: false, message: 'Invalid JSON request body.' }),
    };
  }

  const courierName = String(payload.courierName || '').toLowerCase();
  const trackingNo = String(payload.trackingNo || '').trim();
  const consignmentId = String(payload.consignmentId || '').trim();
  const action = String(payload.action || 'status');

  if (courierName.includes('steadfast')) {
    const apiKey = process.env.STEADFAST_API_KEY;
    const secretKey = process.env.STEADFAST_SECRET_KEY;
    if (!apiKey || !secretKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          configured: false,
          courier: 'Steadfast',
          message:
            'Steadfast API environment keys (STEADFAST_API_KEY, STEADFAST_SECRET_KEY) are not configured on the host. Use manual status update or Bulk CSV booking.',
        }),
      };
    }

    try {
      if (action === 'book' && payload.invoice) {
        const res = await fetch('https://portal.packzy.com/api/v1/create_order', {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Secret-Key': secretKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload.invoice),
        });
        const json: any = await res.json();
        const consignment = json?.consignment || {};
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            configured: true,
            courier: 'Steadfast',
            status: 'Booked' as CourierStatus,
            trackingNo: consignment.tracking_code || trackingNo,
            consignmentId: consignment.consignment_id ? String(consignment.consignment_id) : consignmentId,
            raw: json,
            message: json?.message || 'Parcel booked with Steadfast.',
          }),
        };
      }

      const endpoint = consignmentId
        ? `https://portal.packzy.com/api/v1/status_by_cid/${encodeURIComponent(consignmentId)}`
        : `https://portal.packzy.com/api/v1/status_by_trackingcode/${encodeURIComponent(trackingNo)}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
      });
      const json: any = await res.json();
      const rawStatus = json?.delivery_status || json?.status || '';
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          configured: true,
          courier: 'Steadfast',
          status: mapSteadfastStatus(rawStatus),
          rawStatus,
          message: rawStatus ? `Steadfast Live Status: ${rawStatus}` : 'Synced from Steadfast.',
        }),
      };
    } catch (err: any) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          configured: true,
          courier: 'Steadfast',
          message: err?.message || 'Failed to contact Steadfast API.',
        }),
      };
    }
  }

  if (courierName.includes('redx')) {
    const token = process.env.REDX_TOKEN;
    if (!token) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          configured: false,
          courier: 'RedX',
          message:
            'RedX API token (REDX_TOKEN) is not configured on the host. Use manual status update or RedX Bulk CSV export.',
        }),
      };
    }

    try {
      const code = trackingNo || consignmentId;
      const res = await fetch(
        `https://openapi.redx.com.bd/v1.0.0-beta/parcel/info/${encodeURIComponent(code)}`,
        {
          method: 'GET',
          headers: {
            'API-ACCESS-TOKEN': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const json: any = await res.json();
      const rawStatus = json?.parcel?.status || json?.status || '';
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          configured: true,
          courier: 'RedX',
          status: mapRedxStatus(rawStatus),
          rawStatus,
          message: rawStatus ? `RedX Live Status: ${rawStatus}` : 'Synced from RedX.',
        }),
      };
    } catch (err: any) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          configured: true,
          courier: 'RedX',
          message: err?.message || 'Failed to contact RedX API.',
        }),
      };
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      configured: false,
      unsupportedCourier: true,
      message:
        'Live API auto-sync supports Steadfast & RedX when host env keys are configured. For this courier, use Track Portal link or update status manually.',
    }),
  };
};
