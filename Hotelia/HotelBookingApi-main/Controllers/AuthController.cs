
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using HotelBookingApi.DTOs.Auth;
using HotelBookingApi.Services;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        // POST /api/auth/register
        [HttpPost("register")]
        public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto dto)
        {
            var result = await _authService.Register(dto);
            return Ok(result);
        }

        // POST /api/auth/login
        [HttpPost("login")]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto dto)
        {
            var result = await _authService.Login(dto);
            return Ok(result);
        }

        // DELETE /api/me  — authenticated user deletes their own account
        [HttpDelete("/api/me")]
        [Authorize]
        public async Task<IActionResult> DeleteMyAccount()
        {
            var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
            if (!role.Equals("User", StringComparison.OrdinalIgnoreCase))
                return Forbid();

            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            await _authService.DeleteAccount(userId);
            return NoContent(); // 204
        }
    }
}