using HotelBookingApi.DTOs.Auth;

namespace HotelBookingApi.Services
{
    public interface IAuthService
    {
        Task<AuthResponseDto> Register(RegisterDto dto);
        Task<AuthResponseDto> Login(LoginDto dto);
        Task DeleteAccount(int userId);
    }
}
